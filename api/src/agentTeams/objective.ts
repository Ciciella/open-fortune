import { agentTeamsRepository } from "./repository";

export async function getActiveObjectiveText() {
	const objective = await agentTeamsRepository.getActiveMasterObjective();
	return objective?.objectiveText ?? "稳健增长，控制回撤";
}

export async function setActiveObjectiveText(objectiveText: string) {
	return agentTeamsRepository.setActiveMasterObjective(objectiveText);
}
