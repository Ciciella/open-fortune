<template>
  <el-container class="agent-teams-page">
    <el-main>
      <el-space direction="vertical" size="middle" fill>
        <section>
          <h2 class="page-title">Master Agent 总控台</h2>
          <p class="page-subtitle">输入整体目标，由总智能体统一调度子智能体并动态选择策略。</p>
        </section>

        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-title">整体目标输入</div>
          </template>
          <el-space direction="vertical" fill>
            <el-input
              v-model="objectiveText"
              type="textarea"
              :rows="3"
              placeholder="例如：在控制最大回撤的前提下，优先捕捉 BTC/ETH 的中短线机会"
            />
            <div class="goal-meta">
              <span>当前版本：{{ objective?.version ?? "-" }}</span>
              <span>目标ID：{{ objective?.objectiveId ?? "-" }}</span>
            </div>
            <el-space>
              <el-button type="primary" :loading="savingObjective" @click="handleSaveObjective">
                保存目标
              </el-button>
              <el-button :loading="loadingOverview" @click="loadAll">刷新</el-button>
            </el-space>
          </el-space>
        </el-card>

        <el-row :gutter="12">
          <el-col :xs="24" :sm="8">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ masterConfig?.safetyMode ?? "-" }}</div>
              <div class="metric-label">安全模式</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ latestDecision?.selectedStrategy ?? "-" }}</div>
              <div class="metric-label">当前策略</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ latestDecision?.strategySource ?? "-" }}</div>
              <div class="metric-label">策略来源</div>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :xs="24" :sm="8">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ overview?.cycleLatencyMs ?? "-" }}</div>
              <div class="metric-label">平均周期耗时(ms)</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ formatPercent(overview?.taskSuccessRate) }}</div>
              <div class="metric-label">任务成功率</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="never" class="metric-card">
              <div class="metric-value">{{ formatPercent(overview?.gateRejectRate) }}</div>
              <div class="metric-label">门控拒绝率</div>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="12" class="content-row">
          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="panel-card panel-fill">
              <template #header>
                <div class="panel-title">Master 决策时间线</div>
              </template>
              <el-space direction="vertical" fill>
                <div
                  v-for="decision in overview?.decisions ?? []"
                  :key="decision.id"
                  class="decision-row"
                  :class="{ active: selectedDecisionId === decision.id }"
                  @click="handleSelectDecision(decision.id)"
                >
                  <div class="decision-title">
                    {{ formatTime(decision.timestamp) }} | {{ decision.selectedStrategy ?? decision.decision }}
                  </div>
                  <div class="decision-text">目标：{{ decision.signal }}</div>
                  <div class="decision-text">选型理由：{{ decision.decision }}</div>
                  <div class="decision-text risk-text">门控：{{ decision.riskVerdict }} | {{ decision.riskReason }}</div>
                </div>
                <el-empty
                  v-if="(overview?.decisions ?? []).length === 0"
                  description="暂无 Master 决策记录"
                />
              </el-space>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="panel-card panel-fill">
              <template #header>
                <div class="panel-title">选中决策详情</div>
              </template>
              <el-space direction="vertical" fill>
                <el-card shadow="never" class="detail-block">
                  <div class="detail-title">执行概览</div>
                  <div class="detail-item"><span class="detail-label">策略：</span>{{ selectedDecision?.selectedStrategy ?? "-" }}</div>
                  <div class="detail-item"><span class="detail-label">来源：</span>{{ selectedDecision?.strategySource ?? "-" }}</div>
                  <div class="detail-item"><span class="detail-label">执行：</span>{{ selectedDecision?.executionResult ?? "-" }}</div>
                </el-card>

                <el-card shadow="never" class="detail-block">
                  <div class="detail-title">结构化思考</div>
                  <div class="detail-item"><span class="detail-label">目标解析：</span>{{ selectedRationale?.objectiveSummary ?? "-" }}</div>
                  <div class="detail-item"><span class="detail-label">选型原因：</span>{{ selectedRationale?.selectionReason ?? "-" }}</div>
                  <div class="detail-item"><span class="detail-label">门控摘要：</span>{{ selectedRationale?.gateSummary ?? "-" }}</div>
                  <div class="detail-item">
                    <el-button
                      size="small"
                      type="primary"
                      plain
                      :disabled="!selectedDecision?.cycleId"
                      @click="handleOpenSelectedDecisionProcess"
                    >
                      查看完整协作过程
                    </el-button>
                  </div>
                </el-card>
              </el-space>
            </el-card>
          </el-col>
        </el-row>
      </el-space>
    </el-main>

    <el-drawer v-model="traceDrawerVisible" title="Master 协作过程" size="56%">
      <el-space direction="vertical" fill>
        <el-card shadow="never" class="detail-block">
          <div class="detail-title">周期轨迹</div>
          <div class="detail-item">周期ID：{{ traceCycleId || "-" }}</div>
          <div class="detail-item">链路条目：{{ traceItems.length }}</div>
        </el-card>

        <el-card v-for="trace in traceItems" :key="`${trace.cycleId}-${trace.teamId}`" shadow="never" class="detail-block">
          <div class="detail-title">{{ trace.teamId }} | {{ trace.status }}</div>
          <div class="detail-item">Lead结论：{{ trace.leadConclusion }}</div>
          <div class="detail-item">门控轨迹：{{ trace.gatesJson }}</div>
          <div class="detail-item">执行摘要：{{ trace.executionJson ?? "-" }}</div>
        </el-card>

        <el-card shadow="never" class="detail-block">
          <div class="detail-title">任务列表</div>
          <div v-if="traceTasks.length === 0" class="detail-item">暂无任务</div>
          <div v-for="task in traceTasks" :key="task.taskId" class="detail-item">
            {{ task.specialistType }} | {{ task.status }} | {{ task.resultSummary ?? "-" }}
          </div>
        </el-card>
      </el-space>
    </el-drawer>
  </el-container>
</template>

<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
	fetchAgentTeamsCycleTrace,
	fetchAgentTeamsOverview,
	fetchAgentTeamsTasks,
	fetchMasterConfig,
	fetchMasterDecisions,
	fetchMasterObjective,
	type AgentTeamsCycleTrace,
	type AgentTeamsOverview,
	type AgentTeamsTask,
	type MasterConfigResponse,
	type MasterDecisionEvent,
	updateMasterObjective,
} from "../services/agentTeams";
import { formatDateTime } from "../utils/dateTime";

const overview = ref<AgentTeamsOverview | null>(null);
const masterConfig = ref<MasterConfigResponse | null>(null);
const masterDecisions = ref<MasterDecisionEvent[]>([]);
const objective = ref<Awaited<ReturnType<typeof fetchMasterObjective>>>(null);
const objectiveText = ref("");
const savingObjective = ref(false);
const loadingOverview = ref(false);

const selectedDecisionId = ref("");
const traceDrawerVisible = ref(false);
const traceCycleId = ref("");
const traceItems = ref<AgentTeamsCycleTrace[]>([]);
const traceTasks = ref<AgentTeamsTask[]>([]);

const selectedDecision = computed(() => {
	const decisions = overview.value?.decisions ?? [];
	return decisions.find((d) => d.id === selectedDecisionId.value) ?? decisions[0] ?? null;
});

const latestDecision = computed(() => overview.value?.decisions?.[0] ?? null);

const selectedRationale = computed(() => {
	if (!selectedDecision.value) return null;
	const detail = masterDecisions.value.find((d) => d.decisionId === selectedDecision.value?.id);
	if (!detail?.rationaleJson) return null;
	try {
		return JSON.parse(detail.rationaleJson) as {
			objectiveSummary: string;
			selectionReason: string;
			gateSummary: string;
		};
	} catch {
		return null;
	}
});

const formatPercent = (value?: number) =>
	typeof value === "number" ? `${value.toFixed(1)}%` : "-";

const formatTime = (time: string) => formatDateTime(time);

const loadAll = async () => {
	loadingOverview.value = true;
	try {
		const [ov, obj, cfg, decisions] = await Promise.all([
			fetchAgentTeamsOverview(),
			fetchMasterObjective(),
			fetchMasterConfig(),
			fetchMasterDecisions(50),
		]);
		overview.value = ov;
		objective.value = obj;
		masterConfig.value = cfg;
		masterDecisions.value = decisions ?? [];
		objectiveText.value = obj?.objectiveText ?? "";
		if (ov.decisions.length && !ov.decisions.some((d) => d.id === selectedDecisionId.value)) {
			selectedDecisionId.value = ov.decisions[0]?.id ?? "";
		}
	} finally {
		loadingOverview.value = false;
	}
};

const handleSaveObjective = async () => {
	if (!objectiveText.value.trim()) {
		ElMessage.warning("请输入整体目标");
		return;
	}
	savingObjective.value = true;
	try {
		const updated = await updateMasterObjective(objectiveText.value.trim());
		if (!updated) {
			ElMessage.error("目标保存失败");
			return;
		}
		ElMessage.success("目标已保存并生效");
		await loadAll();
	} finally {
		savingObjective.value = false;
	}
};

const handleSelectDecision = (decisionId: string) => {
	selectedDecisionId.value = decisionId;
};

const handleOpenSelectedDecisionProcess = async () => {
	if (!selectedDecision.value?.cycleId) return;
	traceCycleId.value = selectedDecision.value.cycleId;
	const [traces, tasks] = await Promise.all([
		fetchAgentTeamsCycleTrace(selectedDecision.value.cycleId),
		fetchAgentTeamsTasks({ cycleId: selectedDecision.value.cycleId, teamId: "master-01", limit: 200 }),
	]);
	traceItems.value = traces ?? [];
	traceTasks.value = tasks ?? [];
	traceDrawerVisible.value = true;
};

const autoRefresh = useIntervalFn(loadAll, 15000, { immediate: false });

onMounted(async () => {
	await loadAll();
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

.goal-meta {
  display: flex;
  gap: 16px;
  color: #6b7280;
  font-size: 12px;
}

.metric-card,
.panel-card,
.detail-block {
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
  min-height: min(620px, calc(100vh - 300px));
}

.panel-fill {
  height: 100%;
}

.panel-title {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
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
