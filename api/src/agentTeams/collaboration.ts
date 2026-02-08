import type {
	GateResult,
	InboxMessage,
	SpecialistType,
	TaskStatus,
	TeamTask,
} from "./types";
import { getChinaTimeISO } from "../utils/timeUtils";

interface TaskBoardInitInput {
	cycleId: string;
	teamId: string;
	tasks: Array<{
		taskId: string;
		specialistType: SpecialistType;
		objective: string;
		inputs: string;
		timeoutMs: number;
		priority: number;
	}>;
}

export class TeamCollaborationBoard {
	private tasks = new Map<string, TeamTask>();
	private inbox: InboxMessage[] = [];
	private gateResults: GateResult[] = [];

	constructor(input: TaskBoardInitInput) {
		const now = getChinaTimeISO();
		for (const item of input.tasks) {
			this.tasks.set(item.taskId, {
				taskId: item.taskId,
				cycleId: input.cycleId,
				teamId: input.teamId,
				specialistType: item.specialistType,
				objective: item.objective,
				inputs: item.inputs,
				timeoutMs: item.timeoutMs,
				priority: item.priority,
				status: "pending",
				resultSummary: null,
				errorMessage: null,
				createdAt: now,
				updatedAt: now,
			});
		}
	}

	listTasks() {
		return [...this.tasks.values()].sort((a, b) => a.priority - b.priority);
	}

	getTask(taskId: string) {
		return this.tasks.get(taskId) ?? null;
	}

	updateTaskStatus(input: {
		taskId: string;
		status: TaskStatus;
		resultSummary?: string | null;
		errorMessage?: string | null;
	}) {
		const task = this.tasks.get(input.taskId);
		if (!task) return null;
		task.status = input.status;
		task.resultSummary = input.resultSummary ?? task.resultSummary ?? null;
		task.errorMessage = input.errorMessage ?? task.errorMessage ?? null;
		task.updatedAt = getChinaTimeISO();
		this.tasks.set(input.taskId, task);
		return task;
	}

	pushInboxMessage(message: InboxMessage) {
		this.inbox.push(message);
	}

	listInbox() {
		return [...this.inbox];
	}

	pushGateResult(result: GateResult) {
		this.gateResults.push(result);
	}

	listGateResults() {
		return [...this.gateResults];
	}

	toTasksSummary() {
		const byStatus: Record<string, number> = {
			pending: 0,
			running: 0,
			succeeded: 0,
			failed: 0,
			skipped: 0,
		};
		for (const task of this.tasks.values()) {
			byStatus[task.status] += 1;
		}
		return JSON.stringify(byStatus);
	}
}
