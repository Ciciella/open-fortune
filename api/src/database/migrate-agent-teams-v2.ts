import "dotenv/config";
import { createClient } from "@libsql/client";
import { createLogger } from "../utils/loggerUtils";
import { CREATE_TABLES_SQL } from "./schema";
import { agentTeamsRepository } from "../agentTeams/repository";

const logger = createLogger({
	name: "db-migrate-agent-teams-v2",
	level: "info",
});

async function migrateAgentTeamsV2() {
	try {
		const dbUrl = process.env.DATABASE_URL || "file:./.voltagent/trading.db";
		logger.info(`连接数据库: ${dbUrl}`);
		const client = createClient({ url: dbUrl });

		await client.executeMultiple(CREATE_TABLES_SQL);
		await agentTeamsRepository.ensureBootstrap();
		logger.info("Agent Teams V2 表结构迁移完成");
		process.exit(0);
	} catch (error) {
		logger.error("Agent Teams V2 迁移失败:", error as any);
		process.exit(1);
	}
}

void migrateAgentTeamsV2();
