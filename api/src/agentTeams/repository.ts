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
	CycleTrace,
	GateResult,
	InboxMessage,
	MasterConfig,
	MasterDecision,
	MasterObjective,
	MasterSafetyMode,
	TaskStatus,
	TeamTask,
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

const MASTER_TEAM_ID = "master-01";

export class AgentTeamsRepository {
	async ensureBootstrap() {
		await this.ensureV2Schema();
		await this.ensureMasterSchema();
		await this.ensureConfig();
		await this.ensureDefaultTeams();
		await this.ensureMasterConfig();
		await this.ensureDefaultObjective();
	}

	private async ensureV2Schema() {
		await dbClient.execute(`
			CREATE TABLE IF NOT EXISTS agent_teams_tasks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				task_id TEXT NOT NULL UNIQUE,
				cycle_id TEXT NOT NULL,
				team_id TEXT NOT NULL,
				specialist_type TEXT NOT NULL,
				objective TEXT NOT NULL,
				inputs TEXT NOT NULL,
				timeout_ms INTEGER NOT NULL,
				priority INTEGER NOT NULL,
				status TEXT NOT NULL,
				result_summary TEXT,
				error_message TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`);
		await dbClient.execute(`
			CREATE TABLE IF NOT EXISTS agent_teams_inbox (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				message_id TEXT NOT NULL UNIQUE,
				cycle_id TEXT NOT NULL,
				team_id TEXT NOT NULL,
				task_id TEXT NOT NULL,
				specialist_type TEXT NOT NULL,
				payload TEXT NOT NULL,
				created_at TEXT NOT NULL
			)
		`);
		await dbClient.execute(`
			CREATE TABLE IF NOT EXISTS agent_teams_gate_results (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				cycle_id TEXT NOT NULL,
				team_id TEXT NOT NULL,
				gate_name TEXT NOT NULL,
				passed INTEGER NOT NULL,
				reason TEXT NOT NULL,
				meta TEXT NOT NULL,
				created_at TEXT NOT NULL
			)
		`);
		await dbClient.execute(`
			CREATE TABLE IF NOT EXISTS agent_teams_cycle_traces (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				cycle_id TEXT NOT NULL,
				team_id TEXT NOT NULL,
				started_at TEXT NOT NULL,
				finished_at TEXT NOT NULL,
				status TEXT NOT NULL,
				lead_conclusion TEXT NOT NULL,
				tasks_json TEXT NOT NULL,
				inbox_json TEXT NOT NULL,
				gates_json TEXT NOT NULL,
				execution_json TEXT,
				UNIQUE(cycle_id, team_id)
			)
		`);

		const alterStatements = [
			"ALTER TABLE agent_teams_decisions ADD COLUMN tasks_summary TEXT",
			"ALTER TABLE agent_teams_decisions ADD COLUMN gate_trail TEXT",
			"ALTER TABLE agent_teams_decisions ADD COLUMN lead_conclusion TEXT",
			"ALTER TABLE agent_teams_decisions ADD COLUMN objective_id TEXT",
			"ALTER TABLE agent_teams_decisions ADD COLUMN selected_strategy TEXT",
			"ALTER TABLE agent_teams_decisions ADD COLUMN strategy_source TEXT",
		];
		for (const statement of alterStatements) {
			try {
				await dbClient.execute(statement);
			} catch {
				// ignore existing column errors
			}
		}
	}

	private async ensureMasterSchema() {
		await dbClient.execute(`
			CREATE TABLE IF NOT EXISTS agent_master_config (
				id INTEGER PRIMARY KEY,
				enabled INTEGER NOT NULL DEFAULT 1,
				safety_mode TEXT NOT NULL DEFAULT 'risk_plus_simulation',
				allow_ephemeral_strategy INTEGER NOT NULL DEFAULT 1,
				legacy_system_enabled INTEGER NOT NULL DEFAULT 0,
				updated_at TEXT NOT NULL
			)
		`);
		await dbClient.execute(`
			CREATE TABLE IF NOT EXISTS agent_master_objectives (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				objective_id TEXT NOT NULL UNIQUE,
				objective_text TEXT NOT NULL,
				status TEXT NOT NULL,
				version INTEGER NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`);
		await dbClient.execute(`
			CREATE TABLE IF NOT EXISTS agent_master_decisions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				decision_id TEXT NOT NULL UNIQUE,
				cycle_id TEXT NOT NULL,
				objective_id TEXT NOT NULL,
				selected_strategy_name TEXT NOT NULL,
				strategy_source TEXT NOT NULL,
				rationale_json TEXT NOT NULL,
				risk_verdict TEXT NOT NULL,
				execution_result TEXT NOT NULL,
				created_at TEXT NOT NULL
			)
		`);
		try {
			await dbClient.execute(
				"ALTER TABLE agent_master_config ADD COLUMN legacy_system_enabled INTEGER NOT NULL DEFAULT 0",
			);
		} catch {
			// ignore existing column errors
		}
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

	async ensureMasterConfig() {
		const config = await this.getMasterConfig();
		if (config) return config;
		const now = getChinaTimeISO();
		const next: MasterConfig = {
			enabled: true,
			safetyMode: "risk_plus_simulation",
			allowEphemeralStrategy: true,
			legacySystemEnabled: false,
			updatedAt: now,
		};
		await dbClient.execute({
			sql: `INSERT INTO agent_master_config
				(id, enabled, safety_mode, allow_ephemeral_strategy, legacy_system_enabled, updated_at)
				VALUES (1, ?, ?, ?, ?, ?)`,
			args: [
				1,
				next.enabled ? 1 : 0,
				next.safetyMode,
				next.allowEphemeralStrategy ? 1 : 0,
				next.legacySystemEnabled ? 1 : 0,
				now,
			],
		});
		return next;
	}

	async getMasterConfig(): Promise<MasterConfig | null> {
		const result = await dbClient.execute(
			"SELECT * FROM agent_master_config WHERE id = 1 LIMIT 1",
		);
		const row = result.rows[0] as Record<string, unknown> | undefined;
		if (!row) return null;
		return {
			enabled: Number(row.enabled) === 1,
			safetyMode: String(row.safety_mode) as MasterSafetyMode,
			allowEphemeralStrategy: Number(row.allow_ephemeral_strategy) === 1,
			legacySystemEnabled: Number(row.legacy_system_enabled) === 1,
			updatedAt: String(row.updated_at),
		};
	}

	async updateMasterConfig(
		patch: Partial<Omit<MasterConfig, "updatedAt">>,
	): Promise<MasterConfig> {
		const current = (await this.getMasterConfig()) ?? (await this.ensureMasterConfig());
		const next: MasterConfig = {
			enabled: patch.enabled ?? current.enabled,
			safetyMode: patch.safetyMode ?? current.safetyMode,
			allowEphemeralStrategy:
				patch.allowEphemeralStrategy ?? current.allowEphemeralStrategy,
			legacySystemEnabled:
				patch.legacySystemEnabled ?? current.legacySystemEnabled,
			updatedAt: getChinaTimeISO(),
		};
		await dbClient.execute({
			sql: `UPDATE agent_master_config
				SET enabled = ?, safety_mode = ?, allow_ephemeral_strategy = ?, legacy_system_enabled = ?, updated_at = ?
				WHERE id = 1`,
			args: [
				next.enabled ? 1 : 0,
				next.safetyMode,
				next.allowEphemeralStrategy ? 1 : 0,
				next.legacySystemEnabled ? 1 : 0,
				next.updatedAt,
			],
		});
		return next;
	}

	async ensureDefaultObjective() {
		const current = await this.getActiveMasterObjective();
		if (current) return current;
		return this.setActiveMasterObjective("稳健增长，控制回撤，优先 BTC 与 ETH 机会");
	}

	async getActiveMasterObjective(): Promise<MasterObjective | null> {
		const result = await dbClient.execute({
			sql: `SELECT * FROM agent_master_objectives
				WHERE status = 'active' ORDER BY version DESC LIMIT 1`,
			args: [],
		});
		const row = result.rows[0] as Record<string, unknown> | undefined;
		if (!row) return null;
		return {
			objectiveId: String(row.objective_id),
			objectiveText: String(row.objective_text),
			status: String(row.status) as MasterObjective["status"],
			version: Number(row.version),
			createdAt: String(row.created_at),
			updatedAt: String(row.updated_at),
		};
	}

	async setActiveMasterObjective(objectiveText: string): Promise<MasterObjective> {
		const now = getChinaTimeISO();
		await dbClient.execute({
			sql: "UPDATE agent_master_objectives SET status = 'archived', updated_at = ? WHERE status = 'active'",
			args: [now],
		});

		const versionResult = await dbClient.execute({
			sql: "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM agent_master_objectives",
			args: [],
		});
		const nextVersion = Number(
			(versionResult.rows[0] as Record<string, unknown>)?.next_version || 1,
		);
		const objectiveId = `objective_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

		await dbClient.execute({
			sql: `INSERT INTO agent_master_objectives
				(objective_id, objective_text, status, version, created_at, updated_at)
				VALUES (?, ?, 'active', ?, ?, ?)`,
			args: [objectiveId, objectiveText, nextVersion, now, now],
		});
		return {
			objectiveId,
			objectiveText,
			status: "active",
			version: nextVersion,
			createdAt: now,
			updatedAt: now,
		};
	}

	async insertMasterDecision(item: MasterDecision) {
		await dbClient.execute({
			sql: `INSERT INTO agent_master_decisions
				(decision_id, cycle_id, objective_id, selected_strategy_name, strategy_source, rationale_json, risk_verdict, execution_result, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				item.decisionId,
				item.cycleId,
				item.objectiveId,
				item.selectedStrategyName,
				item.strategySource,
				item.rationaleJson,
				item.riskVerdict,
				item.executionResult,
				item.createdAt,
			],
		});
	}

	async listMasterDecisions(limit = 20): Promise<MasterDecision[]> {
		const result = await dbClient.execute({
			sql: `SELECT * FROM agent_master_decisions ORDER BY created_at DESC LIMIT ?`,
			args: [limit],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				decisionId: String(data.decision_id),
				cycleId: String(data.cycle_id),
				objectiveId: String(data.objective_id),
				selectedStrategyName: String(data.selected_strategy_name),
				strategySource: String(data.strategy_source) as MasterDecision["strategySource"],
				rationaleJson: String(data.rationale_json),
				riskVerdict: String(data.risk_verdict) as MasterDecision["riskVerdict"],
				executionResult: String(data.execution_result),
				createdAt: String(data.created_at),
			};
		});
	}

	async getMasterDecisionById(decisionId: string): Promise<MasterDecision | null> {
		const result = await dbClient.execute({
			sql: `SELECT * FROM agent_master_decisions WHERE decision_id = ? LIMIT 1`,
			args: [decisionId],
		});
		const row = result.rows[0] as Record<string, unknown> | undefined;
		if (!row) return null;
		return {
			decisionId: String(row.decision_id),
			cycleId: String(row.cycle_id),
			objectiveId: String(row.objective_id),
			selectedStrategyName: String(row.selected_strategy_name),
			strategySource: String(row.strategy_source) as MasterDecision["strategySource"],
			rationaleJson: String(row.rationale_json),
			riskVerdict: String(row.risk_verdict) as MasterDecision["riskVerdict"],
			executionResult: String(row.execution_result),
			createdAt: String(row.created_at),
		};
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
		const teams = result.rows.map((row) => {
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
		return [
			{
				teamId: MASTER_TEAM_ID,
				teamName: "总智能体 Master",
				teamType: "trend_team",
				status: "running",
				riskLevel: "medium",
				createdAt: getChinaTimeISO(),
				updatedAt: getChinaTimeISO(),
			},
			...teams,
		];
	}

	async updateTeamStatus(teamId: string, status: AgentTeamStatus) {
		if (teamId === MASTER_TEAM_ID) {
			return;
		}
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

	async upsertPosition(item: Omit<AgentTeamsPosition, "id">) {
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

	async listRecentOrders(limit: number): Promise<AgentTeamsOrder[]> {
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
				(decision_id, team_id, cycle_id, signal_summary, decision_text, risk_verdict, risk_reason, execution_result, confidence, reward_risk_ratio, tasks_summary, gate_trail, lead_conclusion, objective_id, selected_strategy, strategy_source, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				item.tasksSummary ?? null,
				item.gateTrail ?? null,
				item.leadConclusion ?? null,
				item.objectiveId ?? null,
				item.selectedStrategy ?? null,
				item.strategySource ?? null,
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
		return result.rows.map((row) => this.mapDecision(row));
	}

	async getDecisionById(decisionId: string): Promise<AgentTeamsDecision | null> {
		const result = await dbClient.execute({
			sql: "SELECT * FROM agent_teams_decisions WHERE decision_id = ? LIMIT 1",
			args: [decisionId],
		});
		const row = result.rows[0];
		if (!row) return null;
		return this.mapDecision(row);
	}

	private mapDecision(row: unknown): AgentTeamsDecision {
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
			tasksSummary: data.tasks_summary ? String(data.tasks_summary) : undefined,
			gateTrail: data.gate_trail ? String(data.gate_trail) : undefined,
			leadConclusion: data.lead_conclusion
				? String(data.lead_conclusion)
				: undefined,
			objectiveId: data.objective_id ? String(data.objective_id) : undefined,
			selectedStrategy: data.selected_strategy
				? String(data.selected_strategy)
				: undefined,
			strategySource: data.strategy_source
				? (String(data.strategy_source) as AgentTeamsDecision["strategySource"])
				: undefined,
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

	async listRecentCycles(limit = 50): Promise<AgentTeamsCycle[]> {
		const result = await dbClient.execute({
			sql: "SELECT * FROM agent_teams_cycles ORDER BY started_at DESC LIMIT ?",
			args: [limit],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				cycleId: String(data.cycle_id),
				startedAt: String(data.started_at),
				finishedAt: String(data.finished_at),
				teamsCount: Number(data.teams_count),
				ordersCount: Number(data.orders_count),
				errorsCount: Number(data.errors_count),
				status: data.status as AgentTeamsCycle["status"],
			};
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

	async insertTask(task: TeamTask) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_tasks
				(task_id, cycle_id, team_id, specialist_type, objective, inputs, timeout_ms, priority, status, result_summary, error_message, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				task.taskId,
				task.cycleId,
				task.teamId,
				task.specialistType,
				task.objective,
				task.inputs,
				task.timeoutMs,
				task.priority,
				task.status,
				task.resultSummary ?? null,
				task.errorMessage ?? null,
				task.createdAt,
				task.updatedAt,
			],
		});
	}

	async updateTaskStatus(input: {
		taskId: string;
		status: TaskStatus;
		resultSummary?: string | null;
		errorMessage?: string | null;
	}) {
		await dbClient.execute({
			sql: `UPDATE agent_teams_tasks
				SET status = ?, result_summary = ?, error_message = ?, updated_at = ?
				WHERE task_id = ?`,
			args: [
				input.status,
				input.resultSummary ?? null,
				input.errorMessage ?? null,
				getChinaTimeISO(),
				input.taskId,
			],
		});
	}

	async listTasks(input?: {
		teamId?: string;
		cycleId?: string;
		status?: TaskStatus;
		limit?: number;
	}): Promise<TeamTask[]> {
		const clauses: string[] = [];
		const args: Array<string | number> = [];
		if (input?.teamId) {
			clauses.push("team_id = ?");
			args.push(input.teamId);
		}
		if (input?.cycleId) {
			clauses.push("cycle_id = ?");
			args.push(input.cycleId);
		}
		if (input?.status) {
			clauses.push("status = ?");
			args.push(input.status);
		}

		const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
		const limit = input?.limit ?? 100;
		const result = await dbClient.execute({
			sql: `SELECT * FROM agent_teams_tasks ${whereSql} ORDER BY created_at DESC LIMIT ?`,
			args: [...args, limit],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				taskId: String(data.task_id),
				cycleId: String(data.cycle_id),
				teamId: String(data.team_id),
				specialistType: data.specialist_type as TeamTask["specialistType"],
				objective: String(data.objective),
				inputs: String(data.inputs),
				timeoutMs: Number(data.timeout_ms),
				priority: Number(data.priority),
				status: data.status as TaskStatus,
				resultSummary: data.result_summary ? String(data.result_summary) : null,
				errorMessage: data.error_message ? String(data.error_message) : null,
				createdAt: String(data.created_at),
				updatedAt: String(data.updated_at),
			};
		});
	}

	async insertInboxMessage(message: InboxMessage) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_inbox
				(message_id, cycle_id, team_id, task_id, specialist_type, payload, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [
				message.messageId,
				message.cycleId,
				message.teamId,
				message.taskId,
				message.specialistType,
				message.payload,
				message.createdAt,
			],
		});
	}

	async listInboxMessages(input: {
		teamId: string;
		cycleId: string;
	}): Promise<InboxMessage[]> {
		const result = await dbClient.execute({
			sql: `SELECT * FROM agent_teams_inbox
				WHERE team_id = ? AND cycle_id = ?
				ORDER BY created_at ASC`,
			args: [input.teamId, input.cycleId],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				messageId: String(data.message_id),
				cycleId: String(data.cycle_id),
				teamId: String(data.team_id),
				taskId: String(data.task_id),
				specialistType: data.specialist_type as InboxMessage["specialistType"],
				payload: String(data.payload),
				createdAt: String(data.created_at),
			};
		});
	}

	async insertGateResults(input: {
		cycleId: string;
		teamId: string;
		results: GateResult[];
	}) {
		for (const result of input.results) {
			await dbClient.execute({
				sql: `INSERT INTO agent_teams_gate_results
					(cycle_id, team_id, gate_name, passed, reason, meta, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)`,
				args: [
					input.cycleId,
					input.teamId,
					result.gateName,
					result.passed ? 1 : 0,
					result.reason,
					result.meta,
					result.createdAt,
				],
			});
		}
	}

	async listGateResults(input: {
		teamId: string;
		cycleId: string;
	}): Promise<GateResult[]> {
		const result = await dbClient.execute({
			sql: `SELECT * FROM agent_teams_gate_results
				WHERE team_id = ? AND cycle_id = ? ORDER BY created_at ASC`,
			args: [input.teamId, input.cycleId],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				gateName: data.gate_name as GateResult["gateName"],
				passed: Number(data.passed) === 1,
				reason: String(data.reason),
				meta: String(data.meta),
				createdAt: String(data.created_at),
			};
		});
	}

	async listGateResultsForRecentCycles(limit = 50): Promise<GateResult[]> {
		const result = await dbClient.execute({
			sql: `SELECT g.* FROM agent_teams_gate_results g
				INNER JOIN (
					SELECT cycle_id FROM agent_teams_cycles ORDER BY started_at DESC LIMIT ?
				) c ON g.cycle_id = c.cycle_id
				ORDER BY g.created_at DESC`,
			args: [limit],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				gateName: data.gate_name as GateResult["gateName"],
				passed: Number(data.passed) === 1,
				reason: String(data.reason),
				meta: String(data.meta),
				createdAt: String(data.created_at),
			};
		});
	}

	async upsertCycleTrace(trace: CycleTrace) {
		await dbClient.execute({
			sql: `INSERT INTO agent_teams_cycle_traces
				(cycle_id, team_id, started_at, finished_at, status, lead_conclusion, tasks_json, inbox_json, gates_json, execution_json)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(cycle_id, team_id) DO UPDATE SET
					finished_at = excluded.finished_at,
					status = excluded.status,
					lead_conclusion = excluded.lead_conclusion,
					tasks_json = excluded.tasks_json,
					inbox_json = excluded.inbox_json,
					gates_json = excluded.gates_json,
					execution_json = excluded.execution_json`,
			args: [
				trace.cycleId,
				trace.teamId,
				trace.startedAt,
				trace.finishedAt,
				trace.status,
				trace.leadConclusion,
				trace.tasksJson,
				trace.inboxJson,
				trace.gatesJson,
				trace.executionJson ?? null,
			],
		});
	}

	async getCycleTrace(cycleId: string) {
		const result = await dbClient.execute({
			sql: `SELECT * FROM agent_teams_cycle_traces WHERE cycle_id = ? ORDER BY team_id ASC`,
			args: [cycleId],
		});
		return result.rows.map((row) => {
			const data = row as Record<string, unknown>;
			return {
				cycleId: String(data.cycle_id),
				teamId: String(data.team_id),
				startedAt: String(data.started_at),
				finishedAt: String(data.finished_at),
				status: data.status as CycleTrace["status"],
				leadConclusion: String(data.lead_conclusion),
				tasksJson: String(data.tasks_json),
				inboxJson: String(data.inbox_json),
				gatesJson: String(data.gates_json),
				executionJson: data.execution_json ? String(data.execution_json) : null,
			};
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

	async getLegacyOpenSymbols(): Promise<Set<string>> {
		const result = await dbClient.execute({
			sql: "SELECT symbol FROM positions",
			args: [],
		});
		return new Set(result.rows.map((row) => String((row as Record<string, unknown>).symbol)));
	}

	getMasterTeamId() {
		return MASTER_TEAM_ID;
	}
}

export const agentTeamsRepository = new AgentTeamsRepository();
