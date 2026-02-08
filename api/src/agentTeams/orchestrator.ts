import { createLogger } from "../utils/loggerUtils";
import { applyLegacySystemSetting } from "../scheduler/legacySystemControl";
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
			const masterConfig = await agentTeamsRepository.getMasterConfig();
			applyLegacySystemSetting({
				legacySystemEnabled: masterConfig?.legacySystemEnabled ?? false,
				agentTeamsEnabled: true,
			});
			logger.info("已关闭旧系统执行链路（切换到 Agent Teams）");
			await agentTeamsScheduler.start(intervalSeconds || 30);
			return;
		}

		if (agentTeamsScheduler.isRunning()) {
			agentTeamsScheduler.stop();
			logger.info("已停止 Agent Teams 调度器");
		}

		const masterConfig = await agentTeamsRepository.getMasterConfig();
		applyLegacySystemSetting({
			legacySystemEnabled: masterConfig?.legacySystemEnabled ?? false,
			agentTeamsEnabled: false,
		});
		logger.info(
			(masterConfig?.legacySystemEnabled ?? false)
				? "已恢复旧系统执行链路"
				: "旧系统开关关闭，保持停止",
		);
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
