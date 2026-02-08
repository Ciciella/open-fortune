import { createExchangeClient } from "../services/exchangeClient";
import { createLogger } from "../utils/loggerUtils";
import { getChinaTimeISO } from "../utils/timeUtils";
import { TeamCollaborationBoard } from "./collaboration";
import {
	chooseStrategyWithRationale,
	generateCandidateStrategies,
	parseGlobalObjective,
} from "./master";
import { executeCandidateOrder } from "./execution";
import { runQualityGates } from "./gates";
import { createLeadTaskPlan, summarizeLeadConclusion } from "./lead";
import { agentTeamsRepository } from "./repository";
import { runSpecialist } from "./specialists";
import { extractLegacySymbols } from "./strategy";
import type {
	AgentTeamRegistryItem,
	AgentTeamsCycle,
	ExecutionPlan,
	GateResult,
	InboxMessage,
	MasterRationale,
	TeamTask,
} from "./types";

const logger = createLogger({
	name: "agent-teams-runtime",
	level: "info",
});

function randomId(prefix: string) {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class AgentTeamsRuntime {
	async runCycleForAllTeams(): Promise<AgentTeamsCycle | null> {
		await agentTeamsRepository.ensureBootstrap();
		const [config, masterConfig] = await Promise.all([
			agentTeamsRepository.getConfig(),
			agentTeamsRepository.getMasterConfig(),
		]);
		if (!config?.enabled || !masterConfig?.enabled) {
			return null;
		}

		const cycleId = `cycle_${Date.now()}`;
		const startedAt = getChinaTimeISO();
		let ordersCount = 0;
		let errorsCount = 0;

		try {
			const exchangeClient = createExchangeClient();
			const [objective, exchangePositions, openPositions, legacyDbSymbols] = await Promise.all([
				agentTeamsRepository.getActiveMasterObjective(),
				exchangeClient.getPositions(),
				agentTeamsRepository.listOpenPositions(),
				agentTeamsRepository.getLegacyOpenSymbols(),
			]);

			const parsed = parseGlobalObjective(objective);
			const candidates = generateCandidateStrategies({
				parsed,
				allowEphemeralStrategy: masterConfig.allowEphemeralStrategy,
			});
			const chosen = chooseStrategyWithRationale({
				parsed,
				candidates,
				safetyMode: masterConfig.safetyMode,
			});
			const selected = chosen.selected;

			const contract = `${selected.symbol}_USDT`;
			const ticker = await exchangeClient.getFuturesTicker(contract);
			const change = Number.parseFloat(ticker.change_percentage || "0");
			const side = change >= 0 ? selected.sideBias : selected.sideBias === "long" ? "short" : "long";
			const activeMarginUsed = openPositions.reduce((sum, item) => sum + item.marginUsed, 0);
			const marginBase = Math.max(10, config.maxBudgetUsdt * 0.08);
			const marginUsdt = parsed.riskLevel === "low" ? marginBase * 0.7 : parsed.riskLevel === "high" ? marginBase * 1.2 : marginBase;
			const leverage = parsed.riskLevel === "low" ? 3 : parsed.riskLevel === "high" ? 6 : 4;

			const plan: ExecutionPlan = {
				teamId: agentTeamsRepository.getMasterTeamId(),
				teamName: "总智能体 Master",
				teamType: selected.teamType,
				symbol: selected.symbol,
				side,
				action: "open",
				leverage,
				marginUsdt,
				signalSummary: `${selected.symbol} 24h涨跌 ${change.toFixed(2)}%，目标驱动策略`,
				decisionText: `选择 ${selected.strategyLabel}，方向 ${side}`,
				confidence: Number((Math.min(0.9, 0.62 + Math.abs(change) / 40)).toFixed(2)),
				rewardRiskRatio: Number((selected.score / 50).toFixed(2)),
				selectedStrategyName: selected.strategyName,
				strategySource: selected.source,
			};

			const pseudoTeam: AgentTeamRegistryItem = {
				teamId: plan.teamId,
				teamName: plan.teamName,
				teamType: plan.teamType,
				status: "running",
				riskLevel: parsed.riskLevel,
				createdAt: startedAt,
				updatedAt: startedAt,
			};

			const leadTasks = createLeadTaskPlan({ cycleId, team: pseudoTeam, plan });
			const board = new TeamCollaborationBoard({
				cycleId,
				teamId: plan.teamId,
				tasks: leadTasks,
			});
			for (const task of board.listTasks()) {
				await agentTeamsRepository.insertTask(task);
			}
			for (const task of board.listTasks()) {
				await this.executeTask({ task, board, plan, cycleId, teamId: plan.teamId });
			}

			const inboxMessages = board.listInbox();
			const leadConclusion = summarizeLeadConclusion({
				team: pseudoTeam,
				plan,
				messages: inboxMessages,
			});

			const exchangeOpenSymbols = extractLegacySymbols(exchangePositions);
			const legacySymbols = new Set<string>();
			// Legacy symbols are restricted to symbols tracked by the old AI trading
			// system and still open on exchange, preventing false positives for Master positions.
			for (const symbol of legacyDbSymbols) {
				if (exchangeOpenSymbols.has(symbol)) {
					legacySymbols.add(symbol);
				}
			}
			const teamOpenPositionCount = await agentTeamsRepository.getTeamOpenPositionCount(plan.teamId);
			const gateOutput = runQualityGates({
				plan,
				messages: inboxMessages,
				activeMarginUsed,
				maxBudgetUsdt: config.maxBudgetUsdt,
				teamOpenPositionCount,
				maxTeamPositions: config.maxTeamPositions,
				legacySymbols,
			});
			for (const gate of gateOutput.results) {
				board.pushGateResult(gate);
			}

			const safetyGate = this.applySafetyMode(masterConfig.safetyMode, selected.source, plan);
			board.pushGateResult(safetyGate);
			if (!safetyGate.passed && gateOutput.verdict !== "reject") {
				gateOutput.verdict = "reject";
				gateOutput.reason = safetyGate.reason;
				gateOutput.adjustedMarginUsdt = 0;
			}
			await agentTeamsRepository.insertGateResults({
				cycleId,
				teamId: plan.teamId,
				results: [...gateOutput.results, safetyGate],
			});

			const rationale: MasterRationale = {
				...chosen.rationale,
				gateSummary: `${gateOutput.verdict}: ${gateOutput.reason}`,
			};

			let executionResult = "未执行";
			let riskVerdict = gateOutput.verdict;
			let executionPayload: unknown = {
				success: false,
				message: gateOutput.reason,
			};

			if (gateOutput.verdict !== "reject") {
				const execution = await executeCandidateOrder({
					plan: { ...plan, marginUsdt: gateOutput.adjustedMarginUsdt },
					exchangeClient,
				});
				executionResult = execution.message;
				executionPayload = execution;
				await agentTeamsRepository.insertOrder({
					orderId: execution.orderId,
					teamId: plan.teamId,
					symbol: plan.symbol,
					side: plan.side,
					action: plan.action,
					price: execution.price,
					quantity: execution.quantity,
					status: execution.success ? "filled" : "rejected",
					exchangeRaw: execution.exchangeRaw,
					createdAt: getChinaTimeISO(),
				});
				if (execution.success) {
					ordersCount += 1;
					await agentTeamsRepository.upsertPosition({
						teamId: plan.teamId,
						symbol: plan.symbol,
						side: plan.side,
						quantity: execution.quantity,
						entryPrice: execution.price,
						leverage: plan.leverage,
						marginUsed: gateOutput.adjustedMarginUsdt,
						openedAt: getChinaTimeISO(),
						status: "open",
					});
				} else {
					errorsCount += 1;
				}
			} else {
				await agentTeamsRepository.insertRiskEvent({
					eventId: randomId("master_risk"),
					teamId: plan.teamId,
					symbol: plan.symbol,
					ruleCode: "MASTER_GATE_REJECT",
					threshold: `safetyMode=${masterConfig.safetyMode}`,
					actualValue: gateOutput.reason,
					actionTaken: "skip_execution",
					createdAt: getChinaTimeISO(),
				});
			}

			const objectiveId = objective?.objectiveId ?? "default_objective";
			const decisionId = randomId("decision");
			await agentTeamsRepository.insertDecision({
				decisionId,
				teamId: plan.teamId,
				cycleId,
				signalSummary: plan.signalSummary,
				decisionText: plan.decisionText,
				riskVerdict,
				riskReason: gateOutput.reason,
				executionResult,
				confidence: plan.confidence,
				rewardRiskRatio: plan.rewardRiskRatio,
				tasksSummary: board.toTasksSummary(),
				gateTrail: JSON.stringify([...gateOutput.results, safetyGate]),
				leadConclusion,
				objectiveId,
				selectedStrategy: selected.strategyName,
				strategySource: selected.source,
				createdAt: getChinaTimeISO(),
			});

			await agentTeamsRepository.insertMasterDecision({
				decisionId,
				cycleId,
				objectiveId,
				selectedStrategyName: selected.strategyName,
				strategySource: selected.source,
				rationaleJson: JSON.stringify(rationale),
				riskVerdict,
				executionResult,
				createdAt: getChinaTimeISO(),
			});

			await this.persistCycleTrace({
				cycleId,
				teamId: plan.teamId,
				startedAt,
				status: "completed",
				leadConclusion,
				board,
				execution: executionPayload,
			});

			const cycle: AgentTeamsCycle = {
				cycleId,
				startedAt,
				finishedAt: getChinaTimeISO(),
				teamsCount: 1,
				ordersCount,
				errorsCount,
				status: "completed",
			};
			await agentTeamsRepository.insertCycle(cycle);
			return cycle;
		} catch (error) {
			logger.error(
				"Master Agent 周期执行失败:",
				error instanceof Error ? error : String(error),
			);
			const cycle: AgentTeamsCycle = {
				cycleId,
				startedAt,
				finishedAt: getChinaTimeISO(),
				teamsCount: 1,
				ordersCount,
				errorsCount: errorsCount + 1,
				status: "failed",
			};
			await agentTeamsRepository.insertCycle(cycle);
			return cycle;
		}
	}

	private applySafetyMode(
		safetyMode: "risk_only" | "risk_plus_simulation" | "manual_confirm",
		strategySource: "builtin" | "ephemeral",
		plan: ExecutionPlan,
	): GateResult {
		const now = getChinaTimeISO();
		if (safetyMode === "risk_only") {
			return {
				gateName: "simulationGate",
				passed: true,
				reason: "风险模式：仅风险门控",
				meta: JSON.stringify({ mode: safetyMode }),
				createdAt: now,
			};
		}
		if (safetyMode === "risk_plus_simulation") {
			const passed = plan.confidence >= 0.6;
			return {
				gateName: "simulationGate",
				passed,
				reason: passed ? "模拟门控通过" : "模拟门控失败：置信度不足",
				meta: JSON.stringify({ mode: safetyMode, confidence: plan.confidence }),
				createdAt: now,
			};
		}
		const passed = strategySource !== "ephemeral";
		return {
			gateName: "manualConfirmGate",
			passed,
			reason: passed
				? "内置策略无需人工确认"
				: "临时策略需要人工确认，当前自动拒绝",
			meta: JSON.stringify({ mode: safetyMode, strategySource }),
			createdAt: now,
		};
	}

	private async executeTask(input: {
		task: TeamTask;
		board: TeamCollaborationBoard;
		plan: ExecutionPlan;
		teamId: string;
		cycleId: string;
	}) {
		input.board.updateTaskStatus({
			taskId: input.task.taskId,
			status: "running",
		});
		await agentTeamsRepository.updateTaskStatus({
			taskId: input.task.taskId,
			status: "running",
		});

		try {
			const reply = runSpecialist(input.task, input.plan);
			const inboxMessage: InboxMessage = {
				messageId: randomId("msg"),
				cycleId: input.cycleId,
				teamId: input.teamId,
				taskId: input.task.taskId,
				specialistType: input.task.specialistType,
				payload: JSON.stringify(reply.payload),
				createdAt: getChinaTimeISO(),
			};

			input.board.pushInboxMessage(inboxMessage);
			input.board.updateTaskStatus({
				taskId: input.task.taskId,
				status: "succeeded",
				resultSummary: reply.summary,
			});
			await agentTeamsRepository.insertInboxMessage(inboxMessage);
			await agentTeamsRepository.updateTaskStatus({
				taskId: input.task.taskId,
				status: "succeeded",
				resultSummary: reply.summary,
			});
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			input.board.updateTaskStatus({
				taskId: input.task.taskId,
				status: "failed",
				errorMessage: reason,
			});
			await agentTeamsRepository.updateTaskStatus({
				taskId: input.task.taskId,
				status: "failed",
				errorMessage: reason,
			});
		}
	}

	private async persistCycleTrace(input: {
		cycleId: string;
		teamId: string;
		startedAt: string;
		status: "completed" | "failed";
		leadConclusion: string;
		board: TeamCollaborationBoard;
		execution?: unknown;
	}) {
		await agentTeamsRepository.upsertCycleTrace({
			cycleId: input.cycleId,
			teamId: input.teamId,
			startedAt: input.startedAt,
			finishedAt: getChinaTimeISO(),
			status: input.status,
			leadConclusion: input.leadConclusion,
			tasksJson: JSON.stringify(input.board.listTasks()),
			inboxJson: JSON.stringify(input.board.listInbox()),
			gatesJson: JSON.stringify(input.board.listGateResults()),
			executionJson: input.execution ? JSON.stringify(input.execution) : null,
		});
	}
}

export const agentTeamsRuntime = new AgentTeamsRuntime();
