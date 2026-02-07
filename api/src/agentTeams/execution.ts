import { getChinaTimeISO } from "../utils/timeUtils";
import { getQuantoMultiplier } from "../utils/contractUtils";
import { createLogger } from "../utils/loggerUtils";
import type { IExchangeClient } from "../services/exchangeClient";
import type { CandidateAction } from "./types";

const logger = createLogger({
	name: "agent-teams-execution",
	level: "info",
});

export interface ExecutionResult {
	success: boolean;
	orderId: string;
	price: number;
	quantity: number;
	message: string;
	exchangeRaw: string;
}

function getLotDecimals(lotSize: number): number {
	const decimals = (lotSize.toString().split(".")[1] || "").length;
	return decimals > 8 ? 8 : decimals;
}

export async function executeCandidateOrder(input: {
	candidate: CandidateAction;
	marginUsdt: number;
	exchangeClient: IExchangeClient;
}): Promise<ExecutionResult> {
	const { candidate, marginUsdt, exchangeClient } = input;
	const contract = `${candidate.symbol}_USDT`;
	const now = getChinaTimeISO();

	try {
		await exchangeClient.setLeverage(contract, candidate.leverage);
		const ticker = await exchangeClient.getFuturesTicker(contract);
		const contractInfo = await exchangeClient.getContractInfo(contract);
		const markPrice = Number.parseFloat(ticker.last || "0");
		if (!Number.isFinite(markPrice) || markPrice <= 0) {
			return {
				success: false,
				orderId: `rejected_${Date.now()}`,
				price: 0,
				quantity: 0,
				message: "价格无效，拒绝执行",
				exchangeRaw: JSON.stringify({ reason: "invalid_price", now }),
			};
		}

		const quantoMultiplier = await getQuantoMultiplier(contract);
		const lotSize = Number.parseFloat(
			contractInfo.lotSize || contractInfo.order_size_round || "1",
		);
		const minSize = Number.parseFloat(
			contractInfo.orderSizeMin || contractInfo.order_size_min || "1",
		);
		let quantity = (marginUsdt * candidate.leverage) / (markPrice * quantoMultiplier);
		if (lotSize > 0) {
			quantity = Math.floor(quantity / lotSize) * lotSize;
			quantity = Number.parseFloat(quantity.toFixed(getLotDecimals(lotSize)));
		}
		quantity = Math.max(quantity, minSize);

		if (!Number.isFinite(quantity) || quantity <= 0) {
			return {
				success: false,
				orderId: `rejected_${Date.now()}`,
				price: markPrice,
				quantity: 0,
				message: "数量无效，拒绝执行",
				exchangeRaw: JSON.stringify({ reason: "invalid_quantity", now }),
			};
		}

		const size = candidate.side === "long" ? quantity : -quantity;
		const order = await exchangeClient.placeOrder({
			contract,
			size,
			price: 0,
		});
		return {
			success: true,
			orderId: String(order.id || `fallback_${Date.now()}`),
			price: markPrice,
			quantity,
			message: `已执行 ${candidate.symbol} ${candidate.side} 开仓`,
			exchangeRaw: JSON.stringify(order),
		};
	} catch (error) {
		logger.error("执行订单失败:", error instanceof Error ? error : String(error));
		return {
			success: false,
			orderId: `failed_${Date.now()}`,
			price: 0,
			quantity: 0,
			message: error instanceof Error ? error.message : "执行异常",
			exchangeRaw: JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
				now,
			}),
		};
	}
}
