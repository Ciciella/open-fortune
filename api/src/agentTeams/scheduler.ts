import { createExchangeClient } from "../services/exchangeClient";
import { createLogger } from "../utils/loggerUtils";
import { getChinaTimeISO } from "../utils/timeUtils";
import { agentTeamsRepository } from "./repository";
import { executeCandidateOrder } from "./execution";
import {
	assessCandidateRisk,
	extractLegacySymbols,
	generateTeamCandidates,
} from "./strategy";

const logger = createLogger({
	name: "agent-teams-scheduler",
	level: "info",
});

export class AgentTeamsScheduler {
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private executing = false;
	private intervalSeconds = 30;

	async start(intervalSeconds: number) {
		this.intervalSeconds = Math.max(5, intervalSeconds);
		if (this.running) {
			this.stop();
		}

		this.running = true;
		await this.executeCycle();
		this.timer = setInterval(() => {
			void this.executeCycle();
		}, this.intervalSeconds * 1000);
		logger.info(`Agent Teams 调度器已启动，间隔 ${this.intervalSeconds}s`);
	}

	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.running = false;
		logger.info("Agent Teams 调度器已停止");
	}

	isRunning() {
		return this.running;
	}

	private async executeCycle() {
		if (this.executing) return;
		this.executing = true;

		const cycleId = `cycle_${Date.now()}`;
		const startedAt = getChinaTimeISO();
		let ordersCount = 0;
		let errorsCount = 0;
		let cycleStatus: "completed" | "failed" = "completed";

		try {
			await agentTeamsRepository.ensureBootstrap();
			const config = await agentTeamsRepository.getConfig();
			if (!config?.enabled) {
				this.executing = false;
				return;
			}

			const [teams, exchangePositions, openPositions] = await Promise.all([
				agentTeamsRepository.listTeams(),
				createExchangeClient().getPositions(),
				agentTeamsRepository.listOpenPositions(),
			]);

			const exchangeClient = createExchangeClient();
			const candidates = await generateTeamCandidates(teams, exchangeClient);
			const legacySymbols = extractLegacySymbols(exchangePositions);
			let activeMarginUsed = openPositions.reduce(
				(sum, item) => sum + item.marginUsed,
				0,
			);

			for (const candidate of candidates) {
				const teamOpenPositionCount =
					await agentTeamsRepository.getTeamOpenPositionCount(candidate.teamId);

				const risk = assessCandidateRisk({
					candidate,
					activeMarginUsed,
					maxBudgetUsdt: config.maxBudgetUsdt,
					teamOpenPositionCount,
					maxTeamPositions: config.maxTeamPositions,
					legacySymbols,
				});

				if (risk.verdict === "reject") {
					await agentTeamsRepository.insertRiskEvent({
						eventId: `risk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
						teamId: candidate.teamId,
						symbol: candidate.symbol,
						ruleCode: "RISK_REJECT",
						threshold: `budget=${config.maxBudgetUsdt},positions=${config.maxTeamPositions}`,
						actualValue: `margin=${candidate.marginUsdt},team_positions=${teamOpenPositionCount}`,
						actionTaken: risk.reason,
						createdAt: getChinaTimeISO(),
					});
					await agentTeamsRepository.insertDecision({
						decisionId: `decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
						teamId: candidate.teamId,
						cycleId,
						signalSummary: candidate.signalSummary,
						decisionText: candidate.decisionText,
						riskVerdict: "reject",
						riskReason: risk.reason,
						executionResult: "未执行",
						confidence: candidate.confidence,
						rewardRiskRatio: candidate.rewardRiskRatio,
						createdAt: getChinaTimeISO(),
					});
					await agentTeamsRepository.updateTeamStatus(candidate.teamId, "alert");
					continue;
				}

				const marginUsdt = risk.adjustedMarginUsdt;
				const execution = await executeCandidateOrder({
					candidate,
					marginUsdt,
					exchangeClient,
				});

				await agentTeamsRepository.insertOrder({
					orderId: execution.orderId,
					teamId: candidate.teamId,
					symbol: candidate.symbol,
					side: candidate.side,
					action: candidate.action,
					price: execution.price,
					quantity: execution.quantity,
					status: execution.success ? "filled" : "rejected",
					exchangeRaw: execution.exchangeRaw,
					createdAt: getChinaTimeISO(),
				});

				await agentTeamsRepository.insertDecision({
					decisionId: `decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					teamId: candidate.teamId,
					cycleId,
					signalSummary: candidate.signalSummary,
					decisionText: candidate.decisionText,
					riskVerdict: risk.verdict === "reduce" ? "reduce" : "pass",
					riskReason: risk.reason,
					executionResult: execution.message,
					confidence: candidate.confidence,
					rewardRiskRatio: candidate.rewardRiskRatio,
					createdAt: getChinaTimeISO(),
				});

				if (execution.success) {
					ordersCount += 1;
					activeMarginUsed += marginUsdt;
					await agentTeamsRepository.upsertPosition({
						teamId: candidate.teamId,
						symbol: candidate.symbol,
						side: candidate.side,
						quantity: execution.quantity,
						entryPrice: execution.price,
						leverage: candidate.leverage,
						marginUsed: marginUsdt,
						openedAt: getChinaTimeISO(),
						status: "open",
					});
					await agentTeamsRepository.updateTeamStatus(candidate.teamId, "running");
				} else {
					errorsCount += 1;
					await agentTeamsRepository.updateTeamStatus(candidate.teamId, "watch");
				}
			}

			await agentTeamsRepository.insertCycle({
				cycleId,
				startedAt,
				finishedAt: getChinaTimeISO(),
				teamsCount: teams.length,
				ordersCount,
				errorsCount,
				status: cycleStatus,
			});
		} catch (error) {
			cycleStatus = "failed";
			errorsCount += 1;
			logger.error(
				"Agent Teams 周期执行失败:",
				error instanceof Error ? error : String(error),
			);
			await agentTeamsRepository.insertCycle({
				cycleId,
				startedAt,
				finishedAt: getChinaTimeISO(),
				teamsCount: 0,
				ordersCount,
				errorsCount,
				status: cycleStatus,
			});
		} finally {
			this.executing = false;
		}
	}
}

export const agentTeamsScheduler = new AgentTeamsScheduler();
