import type {
	AgentTeamRegistryItem,
	ExecutionPlan,
	InboxMessage,
	SpecialistType,
	TeamTask,
} from "./types";

interface LeadTaskTemplate {
	specialistType: SpecialistType;
	objective: string;
	timeoutMs: number;
	priority: number;
}

const TASK_TEMPLATES: Record<
	AgentTeamRegistryItem["teamType"],
	LeadTaskTemplate[]
> = {
	trend_team: [
		{
			specialistType: "market_analyst",
			objective: "评估趋势强度、波动结构与方向一致性",
			timeoutMs: 1200,
			priority: 1,
		},
		{
			specialistType: "signal_validator",
			objective: "校验信号质量与置信度区间",
			timeoutMs: 1000,
			priority: 2,
		},
		{
			specialistType: "risk_analyst",
			objective: "评估仓位风险与潜在回撤",
			timeoutMs: 1000,
			priority: 3,
		},
		{
			specialistType: "execution_planner",
			objective: "生成执行节奏与滑点控制建议",
			timeoutMs: 900,
			priority: 4,
		},
	],
	arbitrage_team: [
		{
			specialistType: "market_analyst",
			objective: "评估价差可持续性与波动风险",
			timeoutMs: 1100,
			priority: 1,
		},
		{
			specialistType: "signal_validator",
			objective: "验证价差阈值与成交条件",
			timeoutMs: 1000,
			priority: 2,
		},
		{
			specialistType: "risk_analyst",
			objective: "复核资金占用与相关性风险",
			timeoutMs: 1000,
			priority: 3,
		},
		{
			specialistType: "execution_planner",
			objective: "确定下单顺序和撤单策略",
			timeoutMs: 900,
			priority: 4,
		},
	],
	market_making_team: [
		{
			specialistType: "market_analyst",
			objective: "评估盘口深度、价差与短时流动性",
			timeoutMs: 1000,
			priority: 1,
		},
		{
			specialistType: "signal_validator",
			objective: "校验挂单方向与信号稳定性",
			timeoutMs: 900,
			priority: 2,
		},
		{
			specialistType: "risk_analyst",
			objective: "检查库存风险与单边暴露",
			timeoutMs: 900,
			priority: 3,
		},
		{
			specialistType: "execution_planner",
			objective: "规划挂撤单节奏与保护阈值",
			timeoutMs: 900,
			priority: 4,
		},
	],
};

export function createLeadTaskPlan(input: {
	cycleId: string;
	team: AgentTeamRegistryItem;
	plan: ExecutionPlan;
}): Array<
	Pick<
		TeamTask,
		| "taskId"
		| "specialistType"
		| "objective"
		| "inputs"
		| "timeoutMs"
		| "priority"
	>
> {
	const templates = TASK_TEMPLATES[input.team.teamType];
	return templates.map((template, index) => ({
		taskId: `${input.cycleId}_${input.team.teamId}_${template.specialistType}_${index + 1}`,
		specialistType: template.specialistType,
		objective: template.objective,
		inputs: JSON.stringify({
			symbol: input.plan.symbol,
			side: input.plan.side,
			leverage: input.plan.leverage,
			marginUsdt: input.plan.marginUsdt,
			signalSummary: input.plan.signalSummary,
		}),
		timeoutMs: template.timeoutMs,
		priority: template.priority,
	}));
}

export function summarizeLeadConclusion(input: {
	team: AgentTeamRegistryItem;
	plan: ExecutionPlan;
	messages: InboxMessage[];
}) {
	const specialistCount = new Set(input.messages.map((item) => item.specialistType))
		.size;
	return `${input.team.teamName} 已完成 ${specialistCount}/4 专家回包，候选 ${input.plan.symbol} ${input.plan.side}，杠杆 ${input.plan.leverage}x，保证金 ${input.plan.marginUsdt.toFixed(2)} USDT`;
}
