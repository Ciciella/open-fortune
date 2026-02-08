import type {
	AgentTeamsDecision,
	MasterConfig,
	MasterDecision,
	MasterObjective,
	MasterSafetyMode,
	TaskStatus,
} from "./types";
import { agentTeamsRepository } from "./repository";

interface AgentTeamsOverviewResponse {
	activeTeams: number;
	executionSuccessRate: number;
	riskWarningTeams: number;
	ordersToday: number;
	cycleLatencyMs: number;
	taskSuccessRate: number;
	gateRejectRate: number;
	teams: Array<{
		id: string;
		name: string;
		status: "running" | "watch" | "alert";
		agents: number;
		tradesPerHour: number;
		drawdownPercent: number;
	}>;
	decisions: Array<{
		id: string;
		teamId: string;
		teamName: string;
		timestamp: string;
		signal: string;
		decision: string;
		riskVerdict: string;
		riskReason: string;
		executionResult: string;
		confidence: number;
		rewardRiskRatio: number;
		cycleId: string;
		tasksSummary?: string;
		gateTrail?: string;
		objectiveId?: string;
		selectedStrategy?: string;
		strategySource?: string;
	}>;
}

export class AgentTeamsService {
	async getOverview(): Promise<AgentTeamsOverviewResponse> {
		await agentTeamsRepository.ensureBootstrap();

		const [masterDecisions, orders, cycles, latestTasks, latestGateResults] =
			await Promise.all([
				agentTeamsRepository.listMasterDecisions(20),
				agentTeamsRepository.listRecentOrders(200),
				agentTeamsRepository.listRecentCycles(50),
				agentTeamsRepository.listTasks({ limit: 500 }),
				agentTeamsRepository.listGateResultsForRecentCycles(50),
			]);

		const now = Date.now();
		const dayAgo = now - 24 * 60 * 60 * 1000;
		const recentOrders = orders.filter((item) => {
			const createdAt = new Date(item.createdAt).getTime();
			return Number.isFinite(createdAt) && createdAt >= dayAgo;
		});

		const filledOrders = recentOrders.filter((item) => item.status === "filled");
		const successRate =
			recentOrders.length > 0
				? (filledOrders.length / recentOrders.length) * 100
				: 0;

		const decisionsResponse = masterDecisions.map((decision) => {
			const rationale = safeParseRationale(decision.rationaleJson);
			return {
				id: decision.decisionId,
				teamId: "master-01",
				teamName: "总智能体 Master",
				timestamp: decision.createdAt,
				signal: rationale.objectiveSummary,
				decision: rationale.selectionReason,
				riskVerdict: decision.riskVerdict,
				riskReason: rationale.gateSummary,
				executionResult: decision.executionResult,
				confidence: 0.8,
				rewardRiskRatio: 1.5,
				cycleId: decision.cycleId,
				tasksSummary: undefined,
				gateTrail: undefined,
				objectiveId: decision.objectiveId,
				selectedStrategy: decision.selectedStrategyName,
				strategySource: decision.strategySource,
			};
		});

		const cycleDurations = cycles
			.map((cycle) => {
				const start = new Date(cycle.startedAt).getTime();
				const end = new Date(cycle.finishedAt).getTime();
				if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
				return end - start;
			})
			.filter((v) => v > 0);
		const cycleLatencyMs = cycleDurations.length
			? Math.round(cycleDurations.reduce((a, b) => a + b, 0) / cycleDurations.length)
			: 0;

		const successTasks = latestTasks.filter((task) => task.status === "succeeded").length;
		const terminalTasks = latestTasks.filter((task) =>
			isTaskTerminal(task.status),
		).length;
		const taskSuccessRate =
			terminalTasks > 0 ? Number(((successTasks / terminalTasks) * 100).toFixed(1)) : 0;

		const rejectedGates = latestGateResults.filter((item) => !item.passed).length;
		const gateRejectRate =
			latestGateResults.length > 0
				? Number(((rejectedGates / latestGateResults.length) * 100).toFixed(1))
				: 0;

		return {
			activeTeams: 1,
			executionSuccessRate: Number(successRate.toFixed(1)),
			riskWarningTeams: decisionsResponse.slice(0, 10).filter((d) => d.riskVerdict === "reject").length,
			ordersToday: recentOrders.length,
			cycleLatencyMs,
			taskSuccessRate,
			gateRejectRate,
			teams: [
				{
					id: "master-01",
					name: "总智能体 Master",
					status: "running",
					agents: 4,
					tradesPerHour: 8,
					drawdownPercent: 2.3,
				},
			],
			decisions: decisionsResponse,
		};
	}

	async getDecisions(teamId?: string, limit = 20): Promise<AgentTeamsDecision[]> {
		await agentTeamsRepository.ensureBootstrap();
		if (teamId && teamId !== "master-01") {
			return [];
		}
		const masterDecisions = await agentTeamsRepository.listMasterDecisions(limit);
		return masterDecisions.map((decision) => ({
			decisionId: decision.decisionId,
			teamId: "master-01",
			cycleId: decision.cycleId,
			signalSummary: safeParseRationale(decision.rationaleJson).objectiveSummary,
			decisionText: safeParseRationale(decision.rationaleJson).selectionReason,
			riskVerdict: decision.riskVerdict,
			riskReason: safeParseRationale(decision.rationaleJson).gateSummary,
			executionResult: decision.executionResult,
			confidence: 0.8,
			rewardRiskRatio: 1.5,
			objectiveId: decision.objectiveId,
			selectedStrategy: decision.selectedStrategyName,
			strategySource: decision.strategySource,
			createdAt: decision.createdAt,
		}));
	}

	async getDecisionById(decisionId: string): Promise<AgentTeamsDecision | null> {
		await agentTeamsRepository.ensureBootstrap();
		const decision = await agentTeamsRepository.getMasterDecisionById(decisionId);
		if (!decision) return null;
		const rationale = safeParseRationale(decision.rationaleJson);
		return {
			decisionId: decision.decisionId,
			teamId: "master-01",
			cycleId: decision.cycleId,
			signalSummary: rationale.objectiveSummary,
			decisionText: rationale.selectionReason,
			riskVerdict: decision.riskVerdict,
			riskReason: rationale.gateSummary,
			executionResult: decision.executionResult,
			confidence: 0.8,
			rewardRiskRatio: 1.5,
			objectiveId: decision.objectiveId,
			selectedStrategy: decision.selectedStrategyName,
			strategySource: decision.strategySource,
			createdAt: decision.createdAt,
		};
	}

	async getCycleTrace(cycleId: string) {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.getCycleTrace(cycleId);
	}

	async getTasks(input: {
		teamId?: string;
		cycleId?: string;
		status?: TaskStatus;
		limit?: number;
	}) {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.listTasks(input);
	}

	async getConfig() {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.getConfig();
	}

	async updateConfig(
		patch: Partial<{
			enabled: boolean;
			intervalSeconds: number;
			maxBudgetUsdt: number;
			maxTeamPositions: number;
		}>,
	) {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.updateConfig(patch);
	}

	async getMasterObjective(): Promise<MasterObjective | null> {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.getActiveMasterObjective();
	}

	async setMasterObjective(objectiveText: string): Promise<MasterObjective> {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.setActiveMasterObjective(objectiveText);
	}

	async getMasterConfig(): Promise<MasterConfig | null> {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.getMasterConfig();
	}

	async updateMasterConfig(
		patch: Partial<{
			enabled: boolean;
			safetyMode: MasterSafetyMode;
			allowEphemeralStrategy: boolean;
			legacySystemEnabled: boolean;
		}>,
	): Promise<MasterConfig> {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.updateMasterConfig(patch);
	}

	async getMasterDecisions(limit = 20): Promise<MasterDecision[]> {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.listMasterDecisions(limit);
	}

	async getMasterDecisionById(decisionId: string): Promise<MasterDecision | null> {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.getMasterDecisionById(decisionId);
	}
}

function isTaskTerminal(status: TaskStatus) {
	return status === "succeeded" || status === "failed" || status === "skipped";
}

function safeParseRationale(value: string) {
	try {
		return JSON.parse(value) as {
			objectiveSummary: string;
			selectionReason: string;
			gateSummary: string;
		};
	} catch {
		return {
			objectiveSummary: "-",
			selectionReason: "-",
			gateSummary: "-",
		};
	}
}

export const agentTeamsService = new AgentTeamsService();
