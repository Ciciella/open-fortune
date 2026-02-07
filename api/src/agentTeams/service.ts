import type { AgentTeamsDecision } from "./types";
import { agentTeamsRepository } from "./repository";

interface AgentTeamsOverviewResponse {
	activeTeams: number;
	executionSuccessRate: number;
	riskWarningTeams: number;
	ordersToday: number;
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
	}>;
}

const TEAM_META: Record<
	string,
	{ agents: number; tradesPerHour: number; drawdownPercent: number }
> = {
	"trend-01": { agents: 12, tradesPerHour: 23, drawdownPercent: 1.2 },
	"arbitrage-03": { agents: 9, tradesPerHour: 11, drawdownPercent: 2.6 },
	"mm-07": { agents: 4, tradesPerHour: 6, drawdownPercent: 4.9 },
};

export class AgentTeamsService {
	async getOverview(): Promise<AgentTeamsOverviewResponse> {
		await agentTeamsRepository.ensureBootstrap();

		const [teams, decisions, orders] = await Promise.all([
			agentTeamsRepository.listTeams(),
			agentTeamsRepository.listDecisions(undefined, 20),
			agentTeamsRepository.listRecentOrders(200),
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

		const teamsResponse = teams.map((team) => {
			const meta = TEAM_META[team.teamId] ?? {
				agents: 6,
				tradesPerHour: 8,
				drawdownPercent: 2.0,
			};
			return {
				id: team.teamId,
				name: team.teamName,
				status: team.status,
				agents: meta.agents,
				tradesPerHour: meta.tradesPerHour,
				drawdownPercent: meta.drawdownPercent,
			};
		});

		const teamNameMap = new Map(teams.map((team) => [team.teamId, team.teamName]));
		const decisionsResponse = decisions.map((decision) => ({
			id: decision.decisionId,
			teamId: decision.teamId,
			teamName: teamNameMap.get(decision.teamId) ?? decision.teamId,
			timestamp: decision.createdAt,
			signal: decision.signalSummary,
			decision: decision.decisionText,
			riskVerdict: decision.riskVerdict,
			riskReason: decision.riskReason,
			executionResult: decision.executionResult,
			confidence: decision.confidence,
			rewardRiskRatio: decision.rewardRiskRatio,
		}));

		return {
			activeTeams: teamsResponse.filter((team) => team.status === "running").length,
			executionSuccessRate: Number(successRate.toFixed(1)),
			riskWarningTeams: teamsResponse.filter((team) => team.status === "alert").length,
			ordersToday: recentOrders.length,
			teams: teamsResponse,
			decisions: decisionsResponse,
		};
	}

	async getDecisions(teamId?: string, limit = 20) {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.listDecisions(teamId, limit);
	}

	async getDecisionById(decisionId: string): Promise<AgentTeamsDecision | null> {
		await agentTeamsRepository.ensureBootstrap();
		return agentTeamsRepository.getDecisionById(decisionId);
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
}

export const agentTeamsService = new AgentTeamsService();
