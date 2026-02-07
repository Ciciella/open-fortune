export type AgentTeamType = "trend_team" | "arbitrage_team" | "market_making_team";
export type AgentTeamStatus = "running" | "watch" | "alert";
export type TradeSide = "long" | "short";
export type OrderAction = "open" | "close";
export type RiskVerdict = "pass" | "reduce" | "reject";

export interface AgentTeamsConfig {
	enabled: boolean;
	intervalSeconds: number;
	maxBudgetUsdt: number;
	maxTeamPositions: number;
	updatedAt: string;
}

export interface AgentTeamRegistryItem {
	teamId: string;
	teamName: string;
	teamType: AgentTeamType;
	status: AgentTeamStatus;
	riskLevel: "low" | "medium" | "high";
	createdAt: string;
	updatedAt: string;
}

export interface AgentTeamsPosition {
	id: number;
	teamId: string;
	symbol: string;
	side: TradeSide;
	quantity: number;
	entryPrice: number;
	leverage: number;
	marginUsed: number;
	openedAt: string;
	status: "open" | "closed";
}

export interface AgentTeamsOrder {
	id: number;
	orderId: string;
	teamId: string;
	symbol: string;
	side: TradeSide;
	action: OrderAction;
	price: number;
	quantity: number;
	status: "pending" | "filled" | "cancelled" | "rejected";
	exchangeRaw?: string | null;
	createdAt: string;
}

export interface AgentTeamsDecision {
	decisionId: string;
	teamId: string;
	cycleId: string;
	signalSummary: string;
	decisionText: string;
	riskVerdict: RiskVerdict;
	riskReason: string;
	executionResult: string;
	confidence: number;
	rewardRiskRatio: number;
	createdAt: string;
}

export interface AgentTeamsCycle {
	cycleId: string;
	startedAt: string;
	finishedAt: string;
	teamsCount: number;
	ordersCount: number;
	errorsCount: number;
	status: "running" | "completed" | "failed";
}

export interface CandidateAction {
	teamId: string;
	teamName: string;
	teamType: AgentTeamType;
	symbol: string;
	side: TradeSide;
	action: OrderAction;
	leverage: number;
	marginUsdt: number;
	signalSummary: string;
	decisionText: string;
	confidence: number;
	rewardRiskRatio: number;
}

export interface RiskAssessment {
	verdict: RiskVerdict;
	reason: string;
	adjustedMarginUsdt: number;
}
