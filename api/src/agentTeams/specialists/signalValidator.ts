import type { ExecutionPlan, TeamTask } from "../types";
import type { SpecialistReply } from "./marketAnalyst";

export function runSignalValidator(task: TeamTask, plan: ExecutionPlan): SpecialistReply {
	const validatedConfidence = Math.max(0.45, Math.min(0.95, plan.confidence));
	const signalQuality = validatedConfidence >= 0.7 ? "high" : "medium";
	return {
		summary: `信号质量 ${signalQuality}，置信度 ${validatedConfidence.toFixed(2)}`,
		payload: {
			specialist: "signal_validator",
			taskId: task.taskId,
			signalQuality,
			validatedConfidence,
			rewardRiskRatio: plan.rewardRiskRatio,
		},
	};
}
