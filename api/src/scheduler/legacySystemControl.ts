import { createLogger } from "../utils/loggerUtils";
import {
	startTradingLoop,
	stopTradingLoop,
	isTradingLoopRunning,
} from "./tradingLoop";
import {
	startTrailingStopMonitor,
	stopTrailingStopMonitor,
} from "./trailingStopMonitor";
import { startStopLossMonitor, stopStopLossMonitor } from "./stopLossMonitor";
import {
	startPartialProfitMonitor,
	stopPartialProfitMonitor,
} from "./partialProfitMonitor";

const logger = createLogger({
	name: "legacy-system-control",
	level: "info",
});

let legacyStarted = false;

export function startLegacySystem() {
	if (legacyStarted) return;
	startTradingLoop();
	startTrailingStopMonitor();
	startStopLossMonitor();
	startPartialProfitMonitor();
	legacyStarted = true;
	logger.info("旧系统已启动（交易循环 + 风控监控）");
}

export function stopLegacySystem() {
	if (!legacyStarted && !isTradingLoopRunning()) return;
	stopPartialProfitMonitor();
	stopStopLossMonitor();
	stopTrailingStopMonitor();
	stopTradingLoop();
	legacyStarted = false;
	logger.info("旧系统已停止（交易循环 + 风控监控）");
}

export function applyLegacySystemSetting(input: {
	legacySystemEnabled: boolean;
	agentTeamsEnabled: boolean;
}) {
	if (!input.legacySystemEnabled || input.agentTeamsEnabled) {
		stopLegacySystem();
		return;
	}
	startLegacySystem();
}

export function isLegacySystemRunning() {
	return legacyStarted || isTradingLoopRunning();
}
