<template>
  <el-container class="agent-teams-page">
    <el-main>
      <el-space direction="vertical" size="middle" fill>
        <section>
          <h2 class="page-title">Agent Teams 交易系统总览</h2>
          <p class="page-subtitle">统一管理团队策略、持仓风险与执行状态。</p>
        </section>

        <el-row :gutter="12">
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ overview?.activeTeams ?? "-" }}</div>
              <div class="metric-label">运行中团队</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">
                {{ formatPercent(overview?.executionSuccessRate) }}
              </div>
              <div class="metric-label">策略执行成功率</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ overview?.riskWarningTeams ?? "-" }}</div>
              <div class="metric-label">风险预警团队</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ overview?.ordersToday ?? "-" }}</div>
              <div class="metric-label">今日执行订单</div>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="12" class="content-row">
          <el-col :xs="24" :lg="6">
            <el-card shadow="never" class="panel-card panel-fill">
              <template #header>
                <div class="panel-title">团队列表（点击查看过程）</div>
              </template>
              <el-space direction="vertical" fill>
                <div
                  v-for="team in overview?.teams ?? []"
                  :key="team.id"
                  class="team-row"
                  :class="{ active: selectedTeamId === team.id }"
                  @click="handleSelectTeam(team.id)"
                >
                  <div>
                    <div class="team-name">{{ team.name }}</div>
                    <div class="team-meta">
                      {{ team.agents }} 个智能体 | {{ team.tradesPerHour }} 笔/小时
                    </div>
                  </div>
                  <div class="team-right">
                    <el-tag size="small" :type="statusTagType(team.status)">
                      {{ statusText(team.status) }}
                    </el-tag>
                    <button class="link-btn" type="button">查看过程</button>
                  </div>
                </div>
              </el-space>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="10">
            <el-card shadow="never" class="panel-card panel-fill">
              <template #header>
                <div class="panel-title">决策时间线</div>
              </template>
              <el-space direction="vertical" fill>
                <div
                  v-for="decision in filteredDecisions"
                  :key="decision.id"
                  class="decision-row"
                  :class="{ active: selectedDecisionId === decision.id }"
                  @click="handleSelectDecision(decision.id)"
                >
                  <div class="decision-title">
                    {{ formatTime(decision.timestamp) }} | {{ decision.teamName }}
                  </div>
                  <div class="decision-text">信号：{{ decision.signal }}</div>
                  <div class="decision-text">决策：{{ decision.decision }}</div>
                  <div class="decision-text risk-text">
                    风控裁决：{{ decision.riskVerdict }}
                  </div>
                </div>
                <el-empty
                  v-if="filteredDecisions.length === 0"
                  description="当前团队暂无决策记录"
                />
              </el-space>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="8">
            <el-card shadow="never" class="panel-card panel-fill">
              <template #header>
                <div class="panel-title">选中决策详情</div>
              </template>
              <el-space direction="vertical" fill>
                <el-card shadow="never" class="detail-block">
                  <div class="detail-title">策略与信号</div>
                  <div class="detail-item">
                    <span class="detail-label">策略建议：</span>
                    <span>{{ selectedDecision?.decision ?? "-" }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">触发信号：</span>
                    <span>{{ selectedDecision?.signal ?? "-" }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">置信度：</span>
                    <span>{{ formatConfidence(selectedDecision?.confidence) }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">预期盈亏比：</span>
                    <span>{{ selectedDecision?.rewardRiskRatio ?? "-" }}</span>
                  </div>
                </el-card>

                <el-card shadow="never" class="detail-block">
                  <div class="detail-title">风控与执行</div>
                  <div class="detail-item">
                    <span class="detail-label">风控裁决：</span>
                    <span>{{ selectedDecision?.riskVerdict ?? "-" }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">裁决原因：</span>
                    <span>{{ selectedDecision?.riskReason ?? "-" }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">执行结果：</span>
                    <span>{{ selectedDecision?.executionResult ?? "-" }}</span>
                  </div>
                </el-card>
              </el-space>
            </el-card>
          </el-col>
        </el-row>
      </el-space>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
	fetchAgentTeamsOverview,
	type AgentTeamsOverview,
	type TeamStatus,
} from "../services/agentTeams";

const overview = ref<AgentTeamsOverview | null>(null);
const selectedTeamId = ref<string>("");
const selectedDecisionId = ref<string>("");

const filteredDecisions = computed(() => {
	const decisions = overview.value?.decisions ?? [];
	if (!selectedTeamId.value) {
		return decisions;
	}
	return decisions.filter((item) => item.teamId === selectedTeamId.value);
});

const selectedDecision = computed(() => {
	const decisions = filteredDecisions.value;
	if (!decisions.length) {
		return null;
	}
	return (
		decisions.find((item) => item.id === selectedDecisionId.value) ??
		decisions[0]
	);
});

const statusText = (status: TeamStatus) => {
	if (status === "running") return "运行中";
	if (status === "watch") return "观察中";
	return "风险告警";
};

const statusTagType = (status: TeamStatus) => {
	if (status === "running") return "success";
	if (status === "watch") return "warning";
	return "danger";
};

const formatPercent = (value?: number) =>
	typeof value === "number" ? `${value.toFixed(1)}%` : "-";

const formatConfidence = (value?: number) =>
	typeof value === "number" ? value.toFixed(2) : "-";

const formatTime = (time: string) =>
	new Date(time).toLocaleTimeString("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

const syncSelection = () => {
	const teams = overview.value?.teams ?? [];
	if (!teams.length) {
		selectedTeamId.value = "";
		selectedDecisionId.value = "";
		return;
	}

	const firstTeam = teams[0];
	if (!firstTeam) {
		selectedTeamId.value = "";
		selectedDecisionId.value = "";
		return;
	}

	if (!teams.some((team) => team.id === selectedTeamId.value)) {
		selectedTeamId.value = firstTeam.id;
	}

	const decisions = filteredDecisions.value;
	if (!decisions.length) {
		selectedDecisionId.value = "";
		return;
	}

	const firstDecision = decisions[0];
	if (!firstDecision) {
		selectedDecisionId.value = "";
		return;
	}

	if (!decisions.some((decision) => decision.id === selectedDecisionId.value)) {
		selectedDecisionId.value = firstDecision.id;
	}
};

const loadOverview = async () => {
	overview.value = await fetchAgentTeamsOverview();
	syncSelection();
};

const handleSelectTeam = (teamId: string) => {
	selectedTeamId.value = teamId;
	const firstDecision = filteredDecisions.value[0];
	selectedDecisionId.value = firstDecision?.id ?? "";
};

const handleSelectDecision = (decisionId: string) => {
	selectedDecisionId.value = decisionId;
};

const autoRefresh = useIntervalFn(loadOverview, 15000, { immediate: false });

onMounted(async () => {
	await loadOverview();
	autoRefresh.resume();
});

onBeforeUnmount(() => {
	autoRefresh.pause();
});
</script>

<style scoped>
.agent-teams-page :deep(.el-main) {
  padding: 80px 24px 24px;
}

.agent-teams-page :deep(.el-space) {
  width: 100%;
  display: flex;
}

.agent-teams-page :deep(.el-space--vertical) {
  align-items: stretch;
}

.agent-teams-page :deep(.el-space__item) {
  width: 100%;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
  color: #111827;
}

.page-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
}

.metric-card {
  border: 1px solid #d1d5db;
}

.metric-value {
  font-size: 28px;
  line-height: 1.2;
  color: #111827;
  font-weight: 700;
}

.metric-label {
  margin-top: 4px;
  color: #6b7280;
}

.content-row {
  min-height: min(620px, calc(100vh - 280px));
}

.panel-fill {
  height: 100%;
}

.panel-card {
  border: 1px solid #d1d5db;
}

.panel-title {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
}

.team-row {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.team-row.active {
  border-color: #60a5fa;
  background: #eff6ff;
}

.team-name {
  color: #1f2937;
  font-weight: 600;
}

.team-meta {
  color: #6b7280;
  margin-top: 4px;
  font-size: 12px;
}

.team-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.link-btn {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.decision-row {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  cursor: pointer;
}

.decision-row.active {
  border-color: #60a5fa;
  background: #eff6ff;
}

.decision-title {
  color: #374151;
  font-weight: 600;
  margin-bottom: 6px;
}

.decision-text {
  color: #4b5563;
  font-size: 13px;
  line-height: 1.5;
}

.risk-text {
  color: #b91c1c;
}

.detail-block {
  border: 1px solid #e5e7eb;
}

.detail-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.detail-item {
  color: #4b5563;
  font-size: 13px;
  line-height: 1.6;
}

.detail-label {
  color: #111827;
  font-weight: 600;
}
</style>
