export type AgentTeamType = "trend_team" | "arbitrage_team" | "market_making_team";
export type AgentTeamStatus = "running" | "watch" | "alert";
export type TradeSide = "long" | "short";
export type OrderAction = "open" | "close";
export type RiskVerdict = "pass" | "reduce" | "reject";
export type TaskStatus =
	| "pending"
	| "running"
	| "succeeded"
	| "failed"
	| "skipped";
export type SpecialistType =
	| "market_analyst"
	| "signal_validator"
	| "risk_analyst"
	| "execution_planner";
export type GateName =
	| "schemaGate"
	| "riskGate"
	| "budgetGate"
	| "executionSafetyGate"
	| "simulationGate"
	| "manualConfirmGate";

export type MasterSafetyMode =
	| "risk_only"
	| "risk_plus_simulation"
	| "manual_confirm";
export type StrategySource = "builtin" | "ephemeral";

export interface AgentTeamsConfig {
	enabled: boolean;
	intervalSeconds: number;
	maxBudgetUsdt: number;
	maxTeamPositions: number;
	updatedAt: string;
}

export interface MasterConfig {
	enabled: boolean;
	safetyMode: MasterSafetyMode;
	allowEphemeralStrategy: boolean;
	legacySystemEnabled: boolean;
	updatedAt: string;
}

export interface MasterObjective {
	objectiveId: string;
	objectiveText: string;
	status: "active" | "archived";
	version: number;
	createdAt: string;
	updatedAt: string;
}

export interface StrategyCandidate {
	strategyName: string;
	strategyLabel: string;
	source: StrategySource;
	teamType: AgentTeamType;
	symbol: string;
	sideBias: TradeSide;
	score: number;
	rationale: string;
	expiresInCycles?: number;
	paramsJson: string;
}

export interface MasterRationale {
	objectiveSummary: string;
	parsedConstraints: string[];
	candidateStrategies: StrategyCandidate[];
	selectionReason: string;
	safetyMode: MasterSafetyMode;
	gateSummary: string;
}

export interface MasterDecision {
	decisionId: string;
	cycleId: string;
	objectiveId: string;
	selectedStrategyName: string;
	strategySource: StrategySource;
	rationaleJson: string;
	riskVerdict: RiskVerdict;
	executionResult: string;
	createdAt: string;
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
	tasksSummary?: string;
	gateTrail?: string;
	leadConclusion?: string;
	objectiveId?: string;
	selectedStrategy?: string;
	strategySource?: StrategySource;
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

export interface TeamTask {
	taskId: string;
	cycleId: string;
	teamId: string;
	specialistType: SpecialistType;
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

export interface InboxMessage {
	messageId: string;
	cycleId: string;
	teamId: string;
	taskId: string;
	specialistType: SpecialistType;
	payload: string;
	createdAt: string;
}

export interface GateResult {
	gateName: GateName;
	passed: boolean;
	reason: string;
	meta: string;
	createdAt: string;
}

export interface ExecutionPlan {
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
	selectedStrategyName?: string;
	strategySource?: StrategySource;
}

export interface CycleTrace {
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
