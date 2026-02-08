export interface AccountData {
	totalBalance: number;
	availableBalance: number;
	unrealisedPnl: number;
	initialBalance: number;
}

export interface StrategyData {
	strategyName: string;
	strategy: string;
	intervalMinutes: number;
	leverageRange: string;
	positionSizeRange: string;
	enableCodeLevelProtection: boolean;
}

export interface PositionData {
	symbol: string;
	side: "long" | "short";
	openSource?: "AI交易" | "Agent Teams" | "未知来源" | "来源冲突";
	leverage?: number;
	entryPrice: number;
	openValue: number;
	currentPrice: number;
	unrealizedPnl: number;
}

export interface PositionsResponse {
	positions: PositionData[];
}

export interface TradeData {
	timestamp: string;
	type: "open" | "close";
	side: "long" | "short";
	openSource?: "AI交易" | "Agent Teams" | "未知来源" | "来源冲突";
	price: number;
	quantity: number;
	leverage: number;
	fee: number;
	pnl?: number | null;
	symbol: string;
	openTimestamp?: string | null;
	closeTimestamp?: string | null;
	holdingDurationSec?: number | null;
}

export interface TradesResponse {
	trades: TradeData[];
}

export interface LogEntry {
	timestamp: string;
	iteration: number;
	decision?: string;
	actionsTaken?: string;
}

export interface LogsResponse {
	logs: LogEntry[];
}

export interface HistoryEntry {
	timestamp: string;
	totalValue: number;
}

export interface HistoryResponse {
	history: HistoryEntry[];
}

export interface PricesResponse {
	prices: Record<string, number>;
}

export interface ClosePositionResponse {
	success: boolean;
	message?: string;
	data?: {
		pnl: number;
	};
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const withBase = (path: string) => `${API_BASE}${path}`;

async function requestJson<T>(
	url: string,
	options?: RequestInit,
): Promise<T | null> {
	try {
		const response = await fetch(url, options);
		const data = (await response.json()) as T & { error?: string };

		if ((data as { error?: string }).error) {
			console.error("API错误:", (data as { error?: string }).error);
			return null;
		}

		return data as T;
	} catch (error) {
		console.error("请求失败:", error);
		return null;
	}
}

export function fetchAccount() {
	return requestJson<AccountData>(withBase("/api/account"));
}

export function fetchStrategy() {
	return requestJson<StrategyData>(withBase("/api/strategy"));
}

export function fetchPositions() {
	return requestJson<PositionsResponse>(withBase("/api/positions"));
}

export function fetchTrades(limit = 100) {
	return requestJson<TradesResponse>(withBase(`/api/trades?limit=${limit}`));
}

export function fetchLogs(limit = 1) {
	return requestJson<LogsResponse>(withBase(`/api/logs?limit=${limit}`));
}

export function fetchHistory() {
	return requestJson<HistoryResponse>(withBase("/api/history"));
}

export function fetchPrices(symbols: string[]) {
	const query = symbols.join(",");
	return requestJson<PricesResponse>(withBase(`/api/prices?symbols=${query}`));
}

export async function closePosition(
	symbol: string,
	password: string,
	openSource?: "AI交易" | "Agent Teams" | "未知来源" | "来源冲突",
) {
	try {
		const response = await fetch(withBase("/api/close-position"), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ symbol, password, openSource }),
		});

		const data = (await response.json()) as ClosePositionResponse;

		return {
			status: response.status,
			data,
		};
	} catch (error) {
		console.error("平仓请求失败:", error);
		return {
			status: 500,
			data: {
				success: false,
				message: error instanceof Error ? error.message : "请求失败",
			},
		};
	}
}
