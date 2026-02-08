import assert from "node:assert/strict";
import { runQualityGates } from "../src/agentTeams/gates";
import { summarizeLeadConclusion } from "../src/agentTeams/lead";
import type { AgentTeamRegistryItem, ExecutionPlan, InboxMessage } from "../src/agentTeams/types";

function message(specialistType: InboxMessage["specialistType"]): InboxMessage {
	return {
		messageId: `m_${specialistType}`,
		cycleId: "cycle_test",
		teamId: "trend-01",
		taskId: `task_${specialistType}`,
		specialistType,
		payload: JSON.stringify({ specialistType }),
		createdAt: new Date().toISOString(),
	};
}

const team: AgentTeamRegistryItem = {
	teamId: "trend-01",
	teamName: "趋势组",
	teamType: "trend_team",
	status: "running",
	riskLevel: "medium",
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const basePlan: ExecutionPlan = {
	teamId: "trend-01",
	teamName: "趋势组",
	teamType: "trend_team",
	symbol: "BTC",
	side: "long",
	action: "open",
	leverage: 5,
	marginUsdt: 20,
	signalSummary: "test",
	decisionText: "open",
	confidence: 0.8,
	rewardRiskRatio: 1.8,
};

const fullMessages = [
	message("market_analyst"),
	message("signal_validator"),
	message("risk_analyst"),
	message("execution_planner"),
];

const passResult = runQualityGates({
	plan: basePlan,
	messages: fullMessages,
	activeMarginUsed: 0,
	maxBudgetUsdt: 200,
	teamOpenPositionCount: 0,
	maxTeamPositions: 3,
	legacySymbols: new Set<string>(),
});
assert.notEqual(passResult.verdict, "reject");

const rejectLeverage = runQualityGates({
	plan: { ...basePlan, leverage: 999 },
	messages: fullMessages,
	activeMarginUsed: 0,
	maxBudgetUsdt: 200,
	teamOpenPositionCount: 0,
	maxTeamPositions: 3,
	legacySymbols: new Set<string>(),
});
assert.equal(rejectLeverage.verdict, "reject");

const rejectBudget = runQualityGates({
	plan: basePlan,
	messages: fullMessages,
	activeMarginUsed: 999,
	maxBudgetUsdt: 200,
	teamOpenPositionCount: 0,
	maxTeamPositions: 3,
	legacySymbols: new Set<string>(),
});
assert.equal(rejectBudget.verdict, "reject");

const rejectSchema = runQualityGates({
	plan: basePlan,
	messages: [message("market_analyst")],
	activeMarginUsed: 0,
	maxBudgetUsdt: 200,
	teamOpenPositionCount: 0,
	maxTeamPositions: 3,
	legacySymbols: new Set<string>(),
});
assert.equal(rejectSchema.verdict, "reject");

const conclusion = summarizeLeadConclusion({
	team,
	plan: basePlan,
	messages: fullMessages,
});
assert.ok(conclusion.includes("4/4"));

console.log("agent-teams-v2 checks passed");
