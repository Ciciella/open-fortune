export type TeamStatus = "running" | "watch" | "alert";
export type TaskStatus =
	| "pending"
	| "running"
	| "succeeded"
	| "failed"
	| "skipped";

export type MasterSafetyMode =
	| "risk_only"
	| "risk_plus_simulation"
	| "manual_confirm";

export interface AgentTeamSummary {
	id: string;
	name: string;
	status: TeamStatus;
	agents: number;
	tradesPerHour: number;
	drawdownPercent: number;
}

export interface DecisionEvent {
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
}

export interface AgentTeamsOverview {
	activeTeams: number;
	executionSuccessRate: number;
	riskWarningTeams: number;
	ordersToday: number;
	cycleLatencyMs: number;
	taskSuccessRate: number;
	gateRejectRate: number;
	teams: AgentTeamSummary[];
	decisions: DecisionEvent[];
}

export interface AgentTeamsTask {
	taskId: string;
	cycleId: string;
	teamId: string;
	specialistType: string;
	objective: string;
	inputs: string;
	timeoutMs: number;
	priority: number;
	status: TaskStatus;
	resultSummary?: string | null;
	errorMessage?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AgentTeamsCycleTrace {
	cycleId: string;
	teamId: string;
	startedAt: string;
	finishedAt: string;
	status: "completed" | "failed";
	leadConclusion: string;
	tasksJson: string;
	inboxJson: string;
	gatesJson: string;
	executionJson?: string | null;
}

export interface AgentTeamsConfigResponse {
	enabled: boolean;
	intervalSeconds: number;
	maxBudgetUsdt: number;
	maxTeamPositions: number;
	updatedAt?: string;
}

export interface MasterObjectiveResponse {
	objectiveId: string;
	objectiveText: string;
	status: "active" | "archived";
	version: number;
	createdAt: string;
	updatedAt: string;
}

export interface MasterConfigResponse {
	enabled: boolean;
	safetyMode: MasterSafetyMode;
	allowEphemeralStrategy: boolean;
	legacySystemEnabled: boolean;
	updatedAt?: string;
}

export interface MasterDecisionEvent {
	decisionId: string;
	cycleId: string;
	objectiveId: string;
	selectedStrategyName: string;
	strategySource: "builtin" | "ephemeral";
	rationaleJson: string;
	riskVerdict: string;
	executionResult: string;
	createdAt: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const withBase = (path: string) => `${API_BASE}${path}`;

async function requestJson<T>(url: string, options?: RequestInit): Promise<T | null> {
	try {
		const response = await fetch(url, options);
		if (!response.ok) {
			return null;
		}
		return (await response.json()) as T;
	} catch (error) {
		console.error("AgentTeams API 请求失败:", error);
		return null;
	}
}

export async function fetchAgentTeamsOverview(): Promise<AgentTeamsOverview> {
	const data = await requestJson<AgentTeamsOverview>(withBase("/api/agent-teams/overview"));
	return (
		data ?? {
			activeTeams: 1,
			executionSuccessRate: 0,
			riskWarningTeams: 0,
			ordersToday: 0,
			cycleLatencyMs: 0,
			taskSuccessRate: 0,
			gateRejectRate: 0,
			teams: [],
			decisions: [],
		}
	);
}

export async function fetchAgentTeamsCycleTrace(
	cycleId: string,
): Promise<AgentTeamsCycleTrace[] | null> {
	const data = await requestJson<{ traces: AgentTeamsCycleTrace[] }>(
		withBase(`/api/agent-teams/cycle/${cycleId}`),
	);
	return data?.traces ?? null;
}

export async function fetchAgentTeamsTasks(input: {
	teamId?: string;
	cycleId?: string;
	status?: TaskStatus;
	limit?: number;
}): Promise<AgentTeamsTask[] | null> {
	const query = new URLSearchParams();
	if (input.teamId) query.set("teamId", input.teamId);
	if (input.cycleId) query.set("cycleId", input.cycleId);
	if (input.status) query.set("status", input.status);
	if (typeof input.limit === "number") query.set("limit", String(input.limit));

	const data = await requestJson<{ tasks: AgentTeamsTask[] }>(
		withBase(`/api/agent-teams/tasks${query.toString() ? `?${query.toString()}` : ""}`),
	);
	return data?.tasks ?? null;
}

export async function fetchAgentTeamsConfig(): Promise<AgentTeamsConfigResponse | null> {
	return requestJson<AgentTeamsConfigResponse>(withBase("/api/agent-teams/config"));
}

export async function updateAgentTeamsConfig(input: {
	enabled?: boolean;
	intervalSeconds?: number;
	maxBudgetUsdt?: number;
	maxTeamPositions?: number;
}): Promise<AgentTeamsConfigResponse | null> {
	return requestJson<AgentTeamsConfigResponse>(withBase("/api/agent-teams/config"), {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(input),
	});
}

export async function fetchMasterObjective(): Promise<MasterObjectiveResponse | null> {
	return requestJson<MasterObjectiveResponse>(withBase("/api/agent-teams/master/objective"));
}

export async function updateMasterObjective(objectiveText: string): Promise<MasterObjectiveResponse | null> {
	return requestJson<MasterObjectiveResponse>(withBase("/api/agent-teams/master/objective"), {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ objectiveText }),
	});
}

export async function fetchMasterConfig(): Promise<MasterConfigResponse | null> {
	return requestJson<MasterConfigResponse>(withBase("/api/agent-teams/master/config"));
}

export async function updateMasterConfig(input: {
	enabled?: boolean;
	safetyMode?: MasterSafetyMode;
	allowEphemeralStrategy?: boolean;
	legacySystemEnabled?: boolean;
}): Promise<MasterConfigResponse | null> {
	return requestJson<MasterConfigResponse>(withBase("/api/agent-teams/master/config"), {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(input),
	});
}

export async function fetchMasterDecisions(limit = 20): Promise<MasterDecisionEvent[] | null> {
	const data = await requestJson<{ decisions: MasterDecisionEvent[] }>(
		withBase(`/api/agent-teams/master/decisions?limit=${limit}`),
	);
	return data?.decisions ?? null;
}

export async function fetchMasterDecisionById(decisionId: string): Promise<MasterDecisionEvent | null> {
	return requestJson<MasterDecisionEvent>(withBase(`/api/agent-teams/master/decision/${decisionId}`));
}

export async function startAgentTeams(): Promise<{ success: boolean } | null> {
	return requestJson<{ success: boolean }>(withBase("/api/agent-teams/control/start"), {
		method: "POST",
	});
}

export async function stopAgentTeams(): Promise<{ success: boolean } | null> {
	return requestJson<{ success: boolean }>(withBase("/api/agent-teams/control/stop"), {
		method: "POST",
	});
}
