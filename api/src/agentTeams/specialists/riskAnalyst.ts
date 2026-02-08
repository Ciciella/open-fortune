import type { ExecutionPlan, TeamTask } from "../types";
import type { SpecialistReply } from "./marketAnalyst";

export function runRiskAnalyst(task: TeamTask, plan: ExecutionPlan): SpecialistReply {
	const riskScore = Number((plan.leverage * 8 + plan.marginUsdt / 4).toFixed(2));
	const suggestedScale = riskScore > 70 ? 0.6 : riskScore > 45 ? 0.8 : 1;
	return {
		summary: `风险评分 ${riskScore}，建议倍率 ${suggestedScale}`,
		payload: {
			specialist: "risk_analyst",
			taskId: task.taskId,
			riskScore,
			suggestedScale,
			maxLeverage: plan.leverage,
		},
	};
}
