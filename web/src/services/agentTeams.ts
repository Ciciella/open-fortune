export type TeamStatus = "running" | "watch" | "alert";

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
}

export interface AgentTeamsOverview {
	activeTeams: number;
	executionSuccessRate: number;
	riskWarningTeams: number;
	ordersToday: number;
	teams: AgentTeamSummary[];
	decisions: DecisionEvent[];
}

export interface AgentTeamsConfigResponse {
	enabled: boolean;
	intervalSeconds: number;
	maxBudgetUsdt: number;
	maxTeamPositions: number;
	updatedAt?: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const withBase = (path: string) => `${API_BASE}${path}`;

async function requestJson<T>(
	url: string,
	options?: RequestInit,
): Promise<T | null> {
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

const mockOverview: AgentTeamsOverview = {
	activeTeams: 12,
	executionSuccessRate: 87.4,
	riskWarningTeams: 4,
	ordersToday: 263,
	teams: [
		{
			id: "trend-01",
			name: "趋势跟随组 #01",
			status: "running",
			agents: 12,
			tradesPerHour: 23,
			drawdownPercent: 1.2,
		},
		{
			id: "arbitrage-03",
			name: "套利引擎组 #03",
			status: "watch",
			agents: 9,
			tradesPerHour: 11,
			drawdownPercent: 2.6,
		},
		{
			id: "mm-07",
			name: "高频做市组 #07",
			status: "alert",
			agents: 4,
			tradesPerHour: 6,
			drawdownPercent: 4.9,
		},
	],
	decisions: [
		{
			id: "evt-1",
			teamId: "trend-01",
			teamName: "趋势跟随组 #01",
			timestamp: "2026-02-07T10:21:33+08:00",
			signal: "BTC 5m 突破 + 成交量放大 1.8x",
			decision: "策略建议开多 18%，目标持有 25 分钟",
			riskVerdict: "仓位下调至 11%",
			riskReason: "短时波动率超阈值 1.3x",
			executionResult: "已成交 11%，平均滑点 0.12%，耗时 420ms",
			confidence: 0.82,
			rewardRiskRatio: 1.9,
		},
		{
			id: "evt-2",
			teamId: "arbitrage-03",
			teamName: "套利引擎组 #03",
			timestamp: "2026-02-07T10:18:07+08:00",
			signal: "跨所价差 0.42%（阈值 0.30%）",
			decision: "策略建议双边开仓 14%",
			riskVerdict: "风控通过",
			riskReason: "保证金占用与滑点都在阈值内",
			executionResult: "执行完成，限价滑点 0.15%",
			confidence: 0.77,
			rewardRiskRatio: 1.5,
		},
		{
			id: "evt-3",
			teamId: "mm-07",
			teamName: "高频做市组 #07",
			timestamp: "2026-02-07T10:12:49+08:00",
			signal: "盘口失衡 + 资金费率突变",
			decision: "策略建议继续做市",
			riskVerdict: "执行拒绝",
			riskReason: "保证金风险指数 78/100",
			executionResult: "风控拦截，未下单",
			confidence: 0.69,
			rewardRiskRatio: 1.2,
		},
	],
};

export async function fetchAgentTeamsOverview(): Promise<AgentTeamsOverview> {
	const data = await requestJson<AgentTeamsOverview>(
		withBase("/api/agent-teams/overview"),
	);
	return data ?? mockOverview;
}

export async function fetchAgentTeamsConfig(): Promise<AgentTeamsConfigResponse | null> {
	return requestJson<AgentTeamsConfigResponse>(
		withBase("/api/agent-teams/config"),
	);
}

export async function updateAgentTeamsConfig(input: {
	enabled?: boolean;
	intervalSeconds?: number;
	maxBudgetUsdt?: number;
	maxTeamPositions?: number;
}): Promise<AgentTeamsConfigResponse | null> {
	return requestJson<AgentTeamsConfigResponse>(
		withBase("/api/agent-teams/config"),
		{
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(input),
		},
	);
}

export async function startAgentTeams(): Promise<{ success: boolean } | null> {
	return requestJson<{ success: boolean }>(
		withBase("/api/agent-teams/control/start"),
		{
			method: "POST",
		},
	);
}

export async function stopAgentTeams(): Promise<{ success: boolean } | null> {
	return requestJson<{ success: boolean }>(
		withBase("/api/agent-teams/control/stop"),
		{
			method: "POST",
		},
	);
}
