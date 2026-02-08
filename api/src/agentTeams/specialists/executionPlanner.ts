import type { ExecutionPlan, TeamTask } from "../types";
import type { SpecialistReply } from "./marketAnalyst";

export function runExecutionPlanner(task: TeamTask, plan: ExecutionPlan): SpecialistReply {
	const maxSlippageBps = plan.teamType === "market_making_team" ? 8 : 15;
	const executionMode = plan.teamType === "arbitrage_team" ? "staged" : "single_market";
	return {
		summary: `执行模式 ${executionMode}，最大滑点 ${maxSlippageBps}bps`,
		payload: {
			specialist: "execution_planner",
			taskId: task.taskId,
			executionMode,
			maxSlippageBps,
			action: plan.action,
		},
	};
}
