import { createLogger } from "../utils/loggerUtils";
import { agentTeamsRuntime } from "./runtime";

const logger = createLogger({
	name: "agent-teams-scheduler",
	level: "info",
});

export class AgentTeamsScheduler {
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private executing = false;
	private intervalSeconds = 30;

	async start(intervalSeconds: number) {
		this.intervalSeconds = Math.max(5, intervalSeconds);
		if (this.running) {
			this.stop();
		}

		this.running = true;
		await this.executeCycle();
		this.timer = setInterval(() => {
			void this.executeCycle();
		}, this.intervalSeconds * 1000);
		logger.info(`Agent Teams 调度器已启动，间隔 ${this.intervalSeconds}s`);
	}

	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.running = false;
		logger.info("Agent Teams 调度器已停止");
	}

	isRunning() {
		return this.running;
	}

	private async executeCycle() {
		if (this.executing) return;
		this.executing = true;
		try {
			await agentTeamsRuntime.runCycleForAllTeams();
		} catch (error) {
			logger.error(
				"Agent Teams 周期执行失败:",
				error instanceof Error ? error : String(error),
			);
		} finally {
			this.executing = false;
		}
	}
}

export const agentTeamsScheduler = new AgentTeamsScheduler();
