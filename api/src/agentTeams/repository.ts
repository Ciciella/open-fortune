import { createClient } from "@libsql/client";
import { getChinaTimeISO } from "../utils/timeUtils";
import { defaultAgentTeamsConfig, normalizeAgentTeamsConfig } from "./config";
import type {
	AgentTeamRegistryItem,
	AgentTeamsConfig,
	AgentTeamsCycle,
	AgentTeamsDecision,
	AgentTeamsOrder,
	AgentTeamsPosition,
	AgentTeamStatus,
} from "./types";

const dbClient = createClient({
	url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

const DEFAULT_TEAMS: Array<{
	teamId: string;
	teamName: string;
	teamType: string;
	riskLevel: string;
}> = [
	{
		teamId: "trend-01",
		teamName: "趋势跟随组 #01",
		teamType: "trend_team",
		riskLevel: "medium",
	},
	{
		teamId: "arbitrage-03",
		teamName: "套利引擎组 #03",
		teamType: "arbitrage_team",
		riskLevel: "low",
	},
	{
		teamId: "mm-07",
		teamName: "高频做市组 #07",
		teamType: "market_making_team",
		riskLevel: "high",
	},
];

export class AgentTeamsRepository {
	async ensureBootstrap() {
		await this.ensureConfig();
		await this.ensureDefaultTeams();
	}

	async ensureConfig() {
		const config = await this.getConfig();
		if (config) return config;

		const next = defaultAgentTeamsConfig();
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_config
				(id, enabled, interval_seconds, max_budget_usdt, max_team_positions, updated_at)
				VALUES (1, ?, ?, ?, ?, ?)`,
			args: [
				next.enabled ? 1 : 0,
				next.intervalSeconds,
				next.maxBudgetUsdt,
				next.maxTeamPositions,
				next.updatedAt,
			],
		});
		return next;
	}

	async getConfig(): Promise<AgentTeamsConfig | null> {
		const result = await dbClient.execute(
			"SELECT * FROM agent_teams_config WHERE id = 1 LIMIT 1",
		);
		if (!result.rows[0]) return null;
		const row = result.rows[0] as Record<string, unknown>;
		return normalizeAgentTeamsConfig({
			enabled: Number(row.enabled) === 1,
			intervalSeconds: Number(row.interval_seconds),
			maxBudgetUsdt: Number(row.max_budget_usdt),
			maxTeamPositions: Number(row.max_team_positions),
			updatedAt: String(row.updated_at),
		});
	}

	async updateConfig(
		patch: Partial<Omit<AgentTeamsConfig, "updatedAt">>,
	): Promise<AgentTeamsConfig> {
		const current = (await this.getConfig()) ?? defaultAgentTeamsConfig();
		const next = normalizeAgentTeamsConfig({
			...current,
			...patch,
			updatedAt: getChinaTimeISO(),
		});
		await dbClient.execute({
			sql: `UPDATE agent_teams_config
				SET enabled = ?, interval_seconds = ?, max_budget_usdt = ?, max_team_positions = ?, updated_at = ?
				WHERE id = 1`,
			args: [
				next.enabled ? 1 : 0,
				next.intervalSeconds,
				next.maxBudgetUsdt,
				next.maxTeamPositions,
				next.updatedAt,
			],
		});
		return next;
	}

	async ensureDefaultTeams() {
		const result = await dbClient.execute(
			"SELECT COUNT(*) AS count FROM agent_teams_registry",
		);
		const count = Number((result.rows[0] as Record<string, unknown>).count || 0);
		if (count > 0) return;

		const now = getChinaTimeISO();
		for (const team of DEFAULT_TEAMS) {
			await dbClient.execute({
				sql: `INSERT INTO agent_teams_registry
					(team_id, team_name, team_type, status, risk_level, created_at, updated_at)
					VALUES (?, ?, ?, 'running', ?, ?, ?)`,
				args: [team.teamId, team.teamName, team.teamType, team.riskLevel, now, now],
			});
		}
	}

	async listTeams(): Promise<AgentTeamRegistryItem[]> {
		const result = await dbClient.execute(
			"SELECT * FROM agent_teams_registry ORDER BY team_id ASC",
		);
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				teamId: String(data.team_id),
				teamName: String(data.team_name),
				teamType: data.team_type as AgentTeamRegistryItem["teamType"],
				status: data.status as AgentTeamStatus,
				riskLevel: data.risk_level as AgentTeamRegistryItem["riskLevel"],
				createdAt: String(data.created_at),
				updatedAt: String(data.updated_at),
			};
		});
	}

	async updateTeamStatus(teamId: string, status: AgentTeamStatus) {
		await dbClient.execute({
			sql: "UPDATE agent_teams_registry SET status = ?, updated_at = ? WHERE team_id = ?",
			args: [status, getChinaTimeISO(), teamId],
		});
	}

	async listOpenPositions(): Promise<AgentTeamsPosition[]> {
		const result = await dbClient.execute({
			sql: "SELECT * FROM agent_teams_positions WHERE status = 'open' ORDER BY opened_at DESC",
			args: [],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				id: Number(data.id),
				teamId: String(data.team_id),
				symbol: String(data.symbol),
				side: data.side as AgentTeamsPosition["side"],
				quantity: Number(data.quantity),
				entryPrice: Number(data.entry_price),
				leverage: Number(data.leverage),
				marginUsed: Number(data.margin_used),
				openedAt: String(data.opened_at),
				status: data.status as AgentTeamsPosition["status"],
			};
		});
	}

	async upsertPosition(
		item: Omit<AgentTeamsPosition, "id">,
	) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_positions
				(team_id, symbol, side, quantity, entry_price, leverage, margin_used, opened_at, status)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(team_id, symbol) DO UPDATE SET
				  side = excluded.side,
				  quantity = excluded.quantity,
				  entry_price = excluded.entry_price,
				  leverage = excluded.leverage,
				  margin_used = excluded.margin_used,
				  opened_at = excluded.opened_at,
				  status = excluded.status`,
			args: [
				item.teamId,
				item.symbol,
				item.side,
				item.quantity,
				item.entryPrice,
				item.leverage,
				item.marginUsed,
				item.openedAt,
				item.status,
			],
		});
	}

	async closePosition(teamId: string, symbol: string) {
		await dbClient.execute({
			sql: "UPDATE agent_teams_positions SET status = 'closed' WHERE team_id = ? AND symbol = ?",
			args: [teamId, symbol],
		});
	}

	async insertOrder(item: Omit<AgentTeamsOrder, "id">) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_orders
				(order_id, team_id, symbol, side, action, price, quantity, status, exchange_raw, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				item.orderId,
				item.teamId,
				item.symbol,
				item.side,
				item.action,
				item.price,
				item.quantity,
				item.status,
				item.exchangeRaw ?? null,
				item.createdAt,
			],
		});
	}

	async listRecentOrders(limit: number) {
		const result = await dbClient.execute({
			sql: "SELECT * FROM agent_teams_orders ORDER BY created_at DESC LIMIT ?",
			args: [limit],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				id: Number(data.id),
				orderId: String(data.order_id),
				teamId: String(data.team_id),
				symbol: String(data.symbol),
				side: data.side as AgentTeamsOrder["side"],
				action: data.action as AgentTeamsOrder["action"],
				price: Number(data.price),
				quantity: Number(data.quantity),
				status: data.status as AgentTeamsOrder["status"],
				exchangeRaw: data.exchange_raw ? String(data.exchange_raw) : null,
				createdAt: String(data.created_at),
			} satisfies AgentTeamsOrder;
		});
	}

	async insertDecision(item: AgentTeamsDecision) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_decisions
				(decision_id, team_id, cycle_id, signal_summary, decision_text, risk_verdict, risk_reason, execution_result, confidence, reward_risk_ratio, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				item.decisionId,
				item.teamId,
				item.cycleId,
				item.signalSummary,
				item.decisionText,
				item.riskVerdict,
				item.riskReason,
				item.executionResult,
				item.confidence,
				item.rewardRiskRatio,
				item.createdAt,
			],
		});
	}

	async listDecisions(teamId?: string, limit = 20): Promise<AgentTeamsDecision[]> {
		const result = teamId
			? await dbClient.execute({
					sql: "SELECT * FROM agent_teams_decisions WHERE team_id = ? ORDER BY created_at DESC LIMIT ?",
					args: [teamId, limit],
				})
			: await dbClient.execute({
					sql: "SELECT * FROM agent_teams_decisions ORDER BY created_at DESC LIMIT ?",
					args: [limit],
				});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				decisionId: String(data.decision_id),
				teamId: String(data.team_id),
				cycleId: String(data.cycle_id),
				signalSummary: String(data.signal_summary),
				decisionText: String(data.decision_text),
				riskVerdict: data.risk_verdict as AgentTeamsDecision["riskVerdict"],
				riskReason: String(data.risk_reason),
				executionResult: String(data.execution_result),
				confidence: Number(data.confidence),
				rewardRiskRatio: Number(data.reward_risk_ratio),
				createdAt: String(data.created_at),
			};
		});
	}

	async getDecisionById(decisionId: string): Promise<AgentTeamsDecision | null> {
		const result = await dbClient.execute({
			sql: "SELECT * FROM agent_teams_decisions WHERE decision_id = ? LIMIT 1",
			args: [decisionId],
		});
		const row = result.rows[0];
		if (!row) return null;
		const data = row as Record<string, unknown>;
		return {
			decisionId: String(data.decision_id),
			teamId: String(data.team_id),
			cycleId: String(data.cycle_id),
			signalSummary: String(data.signal_summary),
			decisionText: String(data.decision_text),
			riskVerdict: data.risk_verdict as AgentTeamsDecision["riskVerdict"],
			riskReason: String(data.risk_reason),
			executionResult: String(data.execution_result),
			confidence: Number(data.confidence),
			rewardRiskRatio: Number(data.reward_risk_ratio),
			createdAt: String(data.created_at),
		};
	}

	async insertCycle(cycle: AgentTeamsCycle) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_cycles
				(cycle_id, started_at, finished_at, teams_count, orders_count, errors_count, status)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [
				cycle.cycleId,
				cycle.startedAt,
				cycle.finishedAt,
				cycle.teamsCount,
				cycle.ordersCount,
				cycle.errorsCount,
				cycle.status,
			],
		});
	}

	async insertRiskEvent(input: {
		eventId: string;
		teamId: string;
		symbol: string;
		ruleCode: string;
		threshold: string;
		actualValue: string;
		actionTaken: string;
		createdAt: string;
	}) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_risk_events
				(event_id, team_id, symbol, rule_code, threshold, actual_value, action_taken, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				input.eventId,
				input.teamId,
				input.symbol,
				input.ruleCode,
				input.threshold,
				input.actualValue,
				input.actionTaken,
				input.createdAt,
			],
		});
	}

	async getActiveMarginUsed(): Promise<number> {
		const result = await dbClient.execute({
			sql: "SELECT COALESCE(SUM(margin_used), 0) AS total FROM agent_teams_positions WHERE status = 'open'",
			args: [],
		});
		return Number((result.rows[0] as Record<string, unknown>).total || 0);
	}

	async getTeamOpenPositionCount(teamId: string): Promise<number> {
		const result = await dbClient.execute({
			sql: "SELECT COUNT(*) AS count FROM agent_teams_positions WHERE team_id = ? AND status = 'open'",
			args: [teamId],
		});
		return Number((result.rows[0] as Record<string, unknown>).count || 0);
	}
}

export const agentTeamsRepository = new AgentTeamsRepository();
