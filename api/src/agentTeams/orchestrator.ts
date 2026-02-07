import { createLogger } from "../utils/loggerUtils";
import {
	isTradingLoopRunning,
	pauseTradingLoop,
	resumeTradingLoop,
} from "../scheduler/tradingLoop";
import { agentTeamsRepository } from "./repository";
import { agentTeamsScheduler } from "./scheduler";

const logger = createLogger({
	name: "agent-teams-orchestrator",
	level: "info",
});

export class AgentTeamsOrchestrator {
	private initialized = false;

	async init() {
		if (this.initialized) return;
		await agentTeamsRepository.ensureBootstrap();
		const config = await agentTeamsRepository.getConfig();
		if (!config) return;

		await this.applyEnabledState(config.enabled, config.intervalSeconds);
		this.initialized = true;
	}

	async applyEnabledState(enabled: boolean, intervalSeconds?: number) {
		if (enabled) {
			if (isTradingLoopRunning()) {
				pauseTradingLoop();
				logger.info("已暂停原有交易循环（切换到 Agent Teams）");
			}
			await agentTeamsScheduler.start(intervalSeconds || 30);
			return;
		}

		if (agentTeamsScheduler.isRunning()) {
			agentTeamsScheduler.stop();
			logger.info("已停止 Agent Teams 调度器");
		}

		if (!isTradingLoopRunning()) {
			resumeTradingLoop();
			logger.info("已恢复原有交易循环");
		}
	}

	async refreshFromConfig() {
		const config = await agentTeamsRepository.getConfig();
		if (!config) return;
		await this.applyEnabledState(config.enabled, config.intervalSeconds);
	}

	async shutdown() {
		if (agentTeamsScheduler.isRunning()) {
			agentTeamsScheduler.stop();
		}
	}
}

export const agentTeamsOrchestrator = new AgentTeamsOrchestrator();
