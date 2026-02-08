import type {
	AgentTeamType,
	MasterObjective,
	MasterRationale,
	MasterSafetyMode,
	StrategyCandidate,
} from "./types";

const SUPPORTED_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"];

export interface ParsedObjective {
	summary: string;
	raw: string;
	symbolHint?: string;
	riskLevel: "low" | "medium" | "high";
	timeframeHint: "short" | "medium" | "long";
	constraints: string[];
}

export function parseGlobalObjective(objective: MasterObjective | null): ParsedObjective {
	const text = (objective?.objectiveText || "稳健增长，控制回撤").trim();
	const upperText = text.toUpperCase();
	const symbolHint = SUPPORTED_SYMBOLS.find((symbol) => upperText.includes(symbol));

	const riskLevel = /低风险|稳健|保守|小回撤/.test(text)
		? "low"
		: /高收益|激进|高风险|all in/i.test(text)
			? "high"
			: "medium";

	const timeframeHint = /分钟|快进快出|日内/.test(text)
		? "short"
		: /周|月|中长线/.test(text)
			? "long"
			: "medium";

	const constraints: string[] = [];
	if (riskLevel === "low") constraints.push("优先控制回撤与杠杆");
	if (riskLevel === "high") constraints.push("优先收益但需触发硬风控");
	if (symbolHint) constraints.push(`优先交易标的: ${symbolHint}`);
	constraints.push(`时间偏好: ${timeframeHint}`);

	return {
		summary: text,
		raw: text,
		symbolHint,
		riskLevel,
		timeframeHint,
		constraints,
	};
}

export function generateCandidateStrategies(input: {
	parsed: ParsedObjective;
	allowEphemeralStrategy: boolean;
}): StrategyCandidate[] {
	const baseSymbol = input.parsed.symbolHint ?? "BTC";
	const candidates: StrategyCandidate[] = [
		makeBuiltIn("trend_follow_master", "趋势跟随", "trend_team", baseSymbol, input.parsed),
		makeBuiltIn("arb_opportunistic_master", "价差套利", "arbitrage_team", input.parsed.symbolHint ?? "ETH", input.parsed),
		makeBuiltIn("liquidity_mm_master", "流动性做市", "market_making_team", input.parsed.symbolHint ?? "SOL", input.parsed),
	];

	if (input.allowEphemeralStrategy) {
		candidates.push(makeEphemeral(input.parsed));
	}

	return candidates.sort((a, b) => b.score - a.score);
}

export function chooseStrategyWithRationale(input: {
	parsed: ParsedObjective;
	candidates: StrategyCandidate[];
	safetyMode: MasterSafetyMode;
}): {
	selected: StrategyCandidate;
	rationale: MasterRationale;
} {
	const selected = input.candidates[0] ?? makeBuiltIn("trend_follow_master", "趋势跟随", "trend_team", input.parsed.symbolHint ?? "BTC", input.parsed);
	const rationale: MasterRationale = {
		objectiveSummary: input.parsed.summary,
		parsedConstraints: input.parsed.constraints,
		candidateStrategies: input.candidates,
		selectionReason: `选择 ${selected.strategyLabel}，评分 ${selected.score.toFixed(1)}，原因：${selected.rationale}`,
		safetyMode: input.safetyMode,
		gateSummary: "待门控执行",
	};
	return { selected, rationale };
}

function makeBuiltIn(
	strategyName: string,
	strategyLabel: string,
	teamType: AgentTeamType,
	symbol: string,
	parsed: ParsedObjective,
): StrategyCandidate {
	const sideBias = parsed.riskLevel === "low" ? "long" : parsed.timeframeHint === "short" ? "short" : "long";
	const baseScore = teamType === "trend_team" ? 78 : teamType === "arbitrage_team" ? 72 : 68;
	const scoreBoost = parsed.symbolHint ? 6 : 0;
	return {
		strategyName,
		strategyLabel,
		source: "builtin",
		teamType,
		symbol,
		sideBias,
		score: baseScore + scoreBoost,
		rationale: `${strategyLabel} 与目标风险偏好匹配`,
		paramsJson: JSON.stringify({ timeframeHint: parsed.timeframeHint, riskLevel: parsed.riskLevel }),
	};
}

function makeEphemeral(parsed: ParsedObjective): StrategyCandidate {
	const symbol = parsed.symbolHint ?? "BTC";
	const sideBias = parsed.timeframeHint === "short" ? "short" : "long";
	const score = parsed.riskLevel === "high" ? 83 : 74;
	return {
		strategyName: `ephemeral_goal_${Date.now()}`,
		strategyLabel: "目标驱动临时策略",
		source: "ephemeral",
		teamType: parsed.timeframeHint === "short" ? "market_making_team" : "trend_team",
		symbol,
		sideBias,
		score,
		rationale: "根据当前全局目标临时生成参数并限制有效周期",
		expiresInCycles: 2,
		paramsJson: JSON.stringify({
			objective: parsed.raw,
			riskLevel: parsed.riskLevel,
			timeframeHint: parsed.timeframeHint,
		}),
	};
}
