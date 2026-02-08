import { RISK_PARAMS } from "../config/riskParams";
import { getChinaTimeISO } from "../utils/timeUtils";
import { assessCandidateRisk } from "./strategy";
import type {
	ExecutionPlan,
	GateResult,
	InboxMessage,
	RiskVerdict,
	SpecialistType,
} from "./types";

interface GateInput {
	plan: ExecutionPlan;
	messages: InboxMessage[];
	activeMarginUsed: number;
	maxBudgetUsdt: number;
	teamOpenPositionCount: number;
	maxTeamPositions: number;
	legacySymbols: Set<string>;
}

interface GateOutput {
	verdict: RiskVerdict;
	reason: string;
	adjustedMarginUsdt: number;
	results: GateResult[];
}

const REQUIRED_SPECIALISTS: SpecialistType[] = [
	"market_analyst",
	"signal_validator",
	"risk_analyst",
	"execution_planner",
];

export function runQualityGates(input: GateInput): GateOutput {
	const results: GateResult[] = [];
	const schema = schemaGate(input.messages);
	results.push(
		toGateResult("schemaGate", schema.passed, schema.reason, {
			messageCount: input.messages.length,
		}),
	);
	if (!schema.passed) {
		return {
			verdict: "reject",
			reason: schema.reason,
			adjustedMarginUsdt: 0,
			results,
		};
	}

	const risk = riskGate(input);
	results.push(
		toGateResult("riskGate", risk.passed, risk.reason, {
			adjustedMarginUsdt: risk.adjustedMarginUsdt,
		}),
	);
	if (!risk.passed) {
		return {
			verdict: "reject",
			reason: risk.reason,
			adjustedMarginUsdt: 0,
			results,
		};
	}

	const budget = budgetGate({
		adjustedMarginUsdt: risk.adjustedMarginUsdt,
		activeMarginUsed: input.activeMarginUsed,
		maxBudgetUsdt: input.maxBudgetUsdt,
	});
	results.push(
		toGateResult("budgetGate", budget.passed, budget.reason, {
			adjustedMarginUsdt: budget.adjustedMarginUsdt,
		}),
	);
	if (!budget.passed) {
		return {
			verdict: "reject",
			reason: budget.reason,
			adjustedMarginUsdt: 0,
			results,
		};
	}

	const safety = executionSafetyGate({
		plan: input.plan,
		adjustedMarginUsdt: budget.adjustedMarginUsdt,
	});
	results.push(toGateResult("executionSafetyGate", safety.passed, safety.reason, {}));
	if (!safety.passed) {
		return {
			verdict: "reject",
			reason: safety.reason,
			adjustedMarginUsdt: 0,
			results,
		};
	}

	const verdict: RiskVerdict =
		budget.adjustedMarginUsdt < input.plan.marginUsdt ? "reduce" : "pass";
	return {
		verdict,
		reason: verdict === "reduce" ? "预算缩量后通过" : "通过风控与执行门控",
		adjustedMarginUsdt: budget.adjustedMarginUsdt,
		results,
	};
}

function schemaGate(messages: InboxMessage[]) {
	const specialists = new Set(messages.map((item) => item.specialistType));
	for (const required of REQUIRED_SPECIALISTS) {
		if (!specialists.has(required)) {
			return {
				passed: false,
				reason: `缺少专家回包: ${required}`,
			};
		}
	}

	for (const message of messages) {
		try {
			const payload = JSON.parse(message.payload) as Record<string, unknown>;
			if (!payload || typeof payload !== "object") {
				return {
					passed: false,
					reason: `专家回包格式无效: ${message.specialistType}`,
				};
			}
		} catch {
			return {
				passed: false,
				reason: `专家回包非 JSON: ${message.specialistType}`,
			};
		}
	}

	return {
		passed: true,
		reason: "专家回包完整",
	};
}

function riskGate(input: GateInput) {
	const risk = assessCandidateRisk({
		candidate: {
			teamId: input.plan.teamId,
			teamName: input.plan.teamName,
			teamType: input.plan.teamType,
			symbol: input.plan.symbol,
			side: input.plan.side,
			action: input.plan.action,
			leverage: input.plan.leverage,
			marginUsdt: input.plan.marginUsdt,
			signalSummary: input.plan.signalSummary,
			decisionText: input.plan.decisionText,
			confidence: input.plan.confidence,
			rewardRiskRatio: input.plan.rewardRiskRatio,
		},
		activeMarginUsed: input.activeMarginUsed,
		maxBudgetUsdt: input.maxBudgetUsdt,
		teamOpenPositionCount: input.teamOpenPositionCount,
		maxTeamPositions: input.maxTeamPositions,
		legacySymbols: input.legacySymbols,
	});
	return {
		passed: risk.verdict !== "reject",
		reason: risk.reason,
		adjustedMarginUsdt: risk.adjustedMarginUsdt,
	};
}

function budgetGate(input: {
	adjustedMarginUsdt: number;
	activeMarginUsed: number;
	maxBudgetUsdt: number;
}) {
	const remaining = input.maxBudgetUsdt - input.activeMarginUsed;
	if (remaining <= 0) {
		return {
			passed: false,
			reason: "预算池耗尽",
			adjustedMarginUsdt: 0,
		};
	}

	const adjusted = Math.min(input.adjustedMarginUsdt, remaining);
	if (adjusted < 5) {
		return {
			passed: false,
			reason: "可用预算低于最小保证金 5 USDT",
			adjustedMarginUsdt: 0,
		};
	}

	return {
		passed: true,
		reason: adjusted < input.adjustedMarginUsdt ? "预算缩量" : "预算通过",
		adjustedMarginUsdt: adjusted,
	};
}

function executionSafetyGate(input: {
	plan: ExecutionPlan;
	adjustedMarginUsdt: number;
}) {
	if (input.plan.leverage <= 0 || input.plan.leverage > RISK_PARAMS.MAX_LEVERAGE) {
		return {
			passed: false,
			reason: `杠杆越界: ${input.plan.leverage}`,
		};
	}
	if (!/^[A-Z0-9]+$/.test(input.plan.symbol)) {
		return {
			passed: false,
			reason: `交易对格式无效: ${input.plan.symbol}`,
		};
	}
	if (input.adjustedMarginUsdt <= 0) {
		return {
			passed: false,
			reason: "执行保证金无效",
		};
	}
	return {
		passed: true,
		reason: "执行安全检查通过",
	};
}

function toGateResult(
	gateName: GateResult["gateName"],
	passed: boolean,
	reason: string,
	meta: Record<string, unknown>,
): GateResult {
	return {
		gateName,
		passed,
		reason,
		meta: JSON.stringify(meta),
		createdAt: getChinaTimeISO(),
	};
}
