import { RISK_PARAMS } from "../../config/riskParams";
import type { IExchangeClient } from "../../services/exchangeClient";
import type {
	AgentTeamRegistryItem,
	CandidateAction,
	RiskAssessment,
} from "../types";

const normalizeSymbol = (contract: string) => contract.replace("_USDT", "");

export async function generateTeamCandidates(
	teams: AgentTeamRegistryItem[],
	exchangeClient: IExchangeClient,
): Promise<CandidateAction[]> {
	const candidates: CandidateAction[] = [];

	for (const team of teams) {
		const symbol = pickSymbolByTeamType(team.teamType);
		const contract = `${symbol}_USDT`;
		const ticker = await exchangeClient.getFuturesTicker(contract);
		const change = Number.parseFloat(ticker.change_percentage || "0");
		const side: "long" | "short" = change >= 0 ? "long" : "short";

		let signalSummary = "";
		let decisionText = "";
		let confidence = 0.7;
		let rewardRiskRatio = 1.5;

		if (team.teamType === "trend_team") {
			signalSummary = `${symbol} 24h涨跌幅 ${change.toFixed(2)}%，趋势跟随信号`;
			decisionText = `趋势突破候选：${side === "long" ? "开多" : "开空"} ${symbol}`;
			confidence = Math.min(0.9, 0.6 + Math.abs(change) / 20);
			rewardRiskRatio = 1.8;
		} else if (team.teamType === "arbitrage_team") {
			const funding = await exchangeClient.getFundingRate(contract);
			const fundingRate = Number.parseFloat(funding.r || "0");
			signalSummary = `${symbol} 资金费率 ${(fundingRate * 100).toFixed(4)}%`;
			decisionText = `价差/费率候选：${fundingRate >= 0 ? "偏空" : "偏多"} ${symbol}`;
			confidence = 0.72;
			rewardRiskRatio = 1.4;
		} else {
			const orderBook = await exchangeClient.getOrderBook(contract, 5);
			const bestBid = Number.parseFloat(orderBook.bids?.[0]?.p || "0");
			const bestAsk = Number.parseFloat(orderBook.asks?.[0]?.p || "0");
			const spread = bestAsk > 0 ? ((bestAsk - bestBid) / bestAsk) * 100 : 0;
			signalSummary = `${symbol} 买卖价差 ${spread.toFixed(3)}%`;
			decisionText = `做市候选：${spread < 0.1 ? "低价差稳态挂单方向" : "高价差谨慎参与"}`;
			confidence = spread < 0.1 ? 0.75 : 0.62;
			rewardRiskRatio = 1.3;
		}

		candidates.push({
			teamId: team.teamId,
			teamName: team.teamName,
			teamType: team.teamType,
			symbol,
			side,
			action: "open",
			leverage: Math.min(6, RISK_PARAMS.MAX_LEVERAGE),
			marginUsdt: 20,
			signalSummary,
			decisionText,
			confidence,
			rewardRiskRatio,
		});
	}

	return candidates;
}

function pickSymbolByTeamType(teamType: AgentTeamRegistryItem["teamType"]) {
	if (teamType === "trend_team") return "BTC";
	if (teamType === "arbitrage_team") return "ETH";
	return "SOL";
}

export function assessCandidateRisk(input: {
	candidate: CandidateAction;
	activeMarginUsed: number;
	maxBudgetUsdt: number;
	teamOpenPositionCount: number;
	maxTeamPositions: number;
	legacySymbols: Set<string>;
}): RiskAssessment {
	const {
		candidate,
		activeMarginUsed,
		maxBudgetUsdt,
		teamOpenPositionCount,
		maxTeamPositions,
		legacySymbols,
	} = input;

	if (candidate.leverage > RISK_PARAMS.MAX_LEVERAGE) {
		return {
			verdict: "reject",
			reason: `杠杆 ${candidate.leverage} 超过系统限制 ${RISK_PARAMS.MAX_LEVERAGE}`,
			adjustedMarginUsdt: 0,
		};
	}

	if (legacySymbols.has(candidate.symbol)) {
		return {
			verdict: "reject",
			reason: `${candidate.symbol} 已被原有交易系统占用，按隔离策略回避`,
			adjustedMarginUsdt: 0,
		};
	}

	if (teamOpenPositionCount >= maxTeamPositions) {
		return {
			verdict: "reject",
			reason: `团队持仓已达上限 ${maxTeamPositions}`,
			adjustedMarginUsdt: 0,
		};
	}

	const remained = maxBudgetUsdt - activeMarginUsed;
	if (remained <= 0) {
		return {
			verdict: "reject",
			reason: "预算池已耗尽",
			adjustedMarginUsdt: 0,
		};
	}

	if (candidate.marginUsdt > remained) {
		return {
			verdict: "reduce",
			reason: `预算不足，仓位由 ${candidate.marginUsdt} 降至 ${Math.max(5, remained).toFixed(2)}`,
			adjustedMarginUsdt: Math.max(5, remained),
		};
	}

	return {
		verdict: "pass",
		reason: "通过风控",
		adjustedMarginUsdt: candidate.marginUsdt,
	};
}

export function extractLegacySymbols(positions: Array<Record<string, unknown>>): Set<string> {
	const symbols = new Set<string>();
	for (const pos of positions) {
		const size = Number.parseFloat(String(pos.size || "0"));
		if (size === 0) continue;
		symbols.add(normalizeSymbol(String(pos.contract || "")));
	}
	return symbols;
}
