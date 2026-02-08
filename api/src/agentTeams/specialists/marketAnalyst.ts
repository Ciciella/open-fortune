import type { ExecutionPlan, TeamTask } from "../types";

export interface SpecialistReply {
	summary: string;
	payload: Record<string, unknown>;
}

export function runMarketAnalyst(task: TeamTask, plan: ExecutionPlan): SpecialistReply {
	const trendStrength = Math.min(0.95, 0.55 + plan.confidence * 0.4);
	return {
		summary: `趋势强度 ${(trendStrength * 100).toFixed(1)}%`,
		payload: {
			specialist: "market_analyst",
			taskId: task.taskId,
			trendStrength,
			direction: plan.side,
			symbol: plan.symbol,
		},
	};
}
