import type {
	ExecutionPlan,
	SpecialistType,
	TeamTask,
} from "../types";
import { runExecutionPlanner } from "./executionPlanner";
import { runMarketAnalyst, type SpecialistReply } from "./marketAnalyst";
import { runRiskAnalyst } from "./riskAnalyst";
import { runSignalValidator } from "./signalValidator";

const SPECIALIST_RUNNERS: Record<
	SpecialistType,
	(task: TeamTask, plan: ExecutionPlan) => SpecialistReply
> = {
	market_analyst: runMarketAnalyst,
	signal_validator: runSignalValidator,
	risk_analyst: runRiskAnalyst,
	execution_planner: runExecutionPlanner,
};

export function runSpecialist(task: TeamTask, plan: ExecutionPlan): SpecialistReply {
	const runner = SPECIALIST_RUNNERS[task.specialistType];
	if (!runner) {
		throw new Error(`未知专家类型: ${task.specialistType}`);
	}
	return runner(task, plan);
}
