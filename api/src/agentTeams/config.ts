import type { AgentTeamsConfig } from "./types";
import { getChinaTimeISO } from "../utils/timeUtils";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface AgentTeamsFileConfig {
	enabled?: boolean;
	intervalSeconds?: number;
	maxBudgetUsdt?: number;
	maxTeamPositions?: number;
}
type AgentTeamsResolvedFileConfig = Required<AgentTeamsFileConfig>;

const AGENT_TEAMS_CONFIG_FILE = resolve(
	process.cwd(),
	"config",
	"agent-teams.config.json",
);

const FILE_DEFAULTS: AgentTeamsResolvedFileConfig = {
	enabled: false,
	intervalSeconds: 30,
	maxBudgetUsdt: 200,
	maxTeamPositions: 3,
};

function readAgentTeamsFileConfig(): AgentTeamsResolvedFileConfig {
	try {
		if (!existsSync(AGENT_TEAMS_CONFIG_FILE)) {
			return FILE_DEFAULTS;
		}

		const raw = readFileSync(AGENT_TEAMS_CONFIG_FILE, "utf-8");
		const parsed = JSON.parse(raw) as AgentTeamsFileConfig;
		return {
			enabled:
				typeof parsed.enabled === "boolean"
					? parsed.enabled
					: FILE_DEFAULTS.enabled,
			intervalSeconds:
				typeof parsed.intervalSeconds === "number"
					? parsed.intervalSeconds
					: FILE_DEFAULTS.intervalSeconds,
			maxBudgetUsdt:
				typeof parsed.maxBudgetUsdt === "number"
					? parsed.maxBudgetUsdt
					: FILE_DEFAULTS.maxBudgetUsdt,
			maxTeamPositions:
				typeof parsed.maxTeamPositions === "number"
					? parsed.maxTeamPositions
					: FILE_DEFAULTS.maxTeamPositions,
		};
	} catch {
		return FILE_DEFAULTS;
	}
}

export const defaultAgentTeamsConfig = (): AgentTeamsConfig => ({
	...readAgentTeamsFileConfig(),
	updatedAt: getChinaTimeISO(),
});

export const normalizeAgentTeamsConfig = (
	value: Partial<AgentTeamsConfig>,
): AgentTeamsConfig => {
	const fallback = defaultAgentTeamsConfig();
	return {
		enabled: value.enabled ?? fallback.enabled,
		intervalSeconds:
			value.intervalSeconds && value.intervalSeconds > 0
				? value.intervalSeconds
				: fallback.intervalSeconds,
		maxBudgetUsdt:
			value.maxBudgetUsdt && value.maxBudgetUsdt > 0
				? value.maxBudgetUsdt
				: fallback.maxBudgetUsdt,
		maxTeamPositions:
			value.maxTeamPositions && value.maxTeamPositions > 0
				? value.maxTeamPositions
				: fallback.maxTeamPositions,
		updatedAt: value.updatedAt ?? getChinaTimeISO(),
	};
};
