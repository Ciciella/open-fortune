<template>
  <el-container class="config-page">
    <el-main>
      <el-space direction="vertical" size="large" fill>
        <section class="title-section">
          <h2 class="page-title">系统配置</h2>
          <p class="page-subtitle">Agent Teams 模块运行与预算配置</p>
        </section>

        <el-alert
          v-if="loadError"
          title="无法获取配置，请检查后端服务"
          type="error"
          :closable="false"
          show-icon
        />

        <el-card shadow="never" class="card">
          <el-row :gutter="16" align="middle">
            <el-col :xs="24" :md="12">
              <div class="status-wrap">
                <span class="status-label">当前状态</span>
                <el-tag :type="isRunning ? 'success' : 'info'" size="large">
                  {{ isRunning ? "运行中" : "已停止" }}
                </el-tag>
              </div>
            </el-col>
            <el-col :xs="24" :md="12">
              <div class="action-wrap">
                <el-button
                  type="success"
                  :loading="loadingStart"
                  :disabled="loadingInit || loadingSave || loadingStop || isRunning"
                  @click="handleStart"
                >
                  立即启动
                </el-button>
                <el-button
                  type="danger"
                  :loading="loadingStop"
                  :disabled="loadingInit || loadingSave || loadingStart || !isRunning"
                  @click="handleStop"
                >
                  立即停止
                </el-button>
                <el-button
                  :loading="loadingInit"
                  :disabled="loadingSave || loadingStart || loadingStop"
                  @click="loadConfig"
                >
                  刷新状态
                </el-button>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" class="card">
          <el-form
            label-width="160px"
            :model="formModel"
            class="config-form"
            @submit.prevent
          >
            <el-form-item label="启用 Agent Teams">
              <el-switch
                v-model="formModel.enabled"
                :disabled="loadingInit || busy"
              />
            </el-form-item>

            <el-form-item label="调度间隔（秒）">
              <el-input-number
                v-model="formModel.intervalSeconds"
                :min="5"
                :step="5"
                :disabled="loadingInit || busy"
              />
            </el-form-item>

            <el-form-item label="预算池（USDT）">
              <el-input-number
                v-model="formModel.maxBudgetUsdt"
                :min="1"
                :step="10"
                :precision="2"
                :disabled="loadingInit || busy"
              />
            </el-form-item>

            <el-form-item label="每团队最大持仓数">
              <el-input-number
                v-model="formModel.maxTeamPositions"
                :min="1"
                :step="1"
                :disabled="loadingInit || busy"
              />
            </el-form-item>

            <el-form-item label="Master 安全模式">
              <el-select
                v-model="formModel.safetyMode"
                :disabled="loadingInit || busy"
                style="width: 280px"
              >
                <el-option label="risk_only（仅风控）" value="risk_only" />
                <el-option
                  label="risk_plus_simulation（风控+模拟）"
                  value="risk_plus_simulation"
                />
                <el-option
                  label="manual_confirm（人工确认）"
                  value="manual_confirm"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="允许临时策略">
              <el-switch
                v-model="formModel.allowEphemeralStrategy"
                :disabled="loadingInit || busy"
              />
            </el-form-item>

            <el-form-item label="旧系统执行开关">
              <el-switch
                v-model="formModel.legacySystemEnabled"
                :disabled="loadingInit || busy"
              />
              <span class="hint-text">关闭后旧交易循环与旧风控监控都不会运行</span>
            </el-form-item>

            <el-form-item label="最近更新时间">
              <span class="updated-at">
                {{ config?.updatedAt ? formatTime(config.updatedAt) : "-" }}
              </span>
            </el-form-item>

            <el-form-item>
              <el-space>
                <el-button
                  :disabled="loadingInit || busy || !config"
                  @click="resetFormFromConfig"
                >
                  重置为服务端当前值
                </el-button>
                <el-button
                  type="primary"
                  :loading="loadingSave"
                  :disabled="!canSave"
                  @click="saveConfig"
                >
                  保存并应用
                </el-button>
              </el-space>
            </el-form-item>
          </el-form>
        </el-card>
      </el-space>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import {
	fetchAgentTeamsConfig,
	fetchMasterConfig,
	startAgentTeams,
	stopAgentTeams,
	updateAgentTeamsConfig,
	updateMasterConfig,
	type AgentTeamsConfigResponse,
	type MasterConfigResponse,
} from "../services/agentTeams";

const config = ref<AgentTeamsConfigResponse | null>(null);
const masterConfig = ref<MasterConfigResponse | null>(null);
const loadError = ref<string | null>(null);

const loadingInit = ref(false);
const loadingSave = ref(false);
const loadingStart = ref(false);
const loadingStop = ref(false);

const formModel = reactive({
	enabled: false,
	intervalSeconds: 30,
	maxBudgetUsdt: 200,
	maxTeamPositions: 3,
	safetyMode: "risk_plus_simulation" as
		| "risk_only"
		| "risk_plus_simulation"
		| "manual_confirm",
	allowEphemeralStrategy: true,
	legacySystemEnabled: false,
});

const busy = computed(
	() =>
		loadingSave.value ||
		loadingStart.value ||
		loadingStop.value ||
		loadingInit.value,
);

const isRunning = computed(() => Boolean(config.value?.enabled));

const isDirty = computed(() => {
	if (!config.value) {
		return false;
	}
	return (
		formModel.enabled !== config.value.enabled ||
		formModel.intervalSeconds !== config.value.intervalSeconds ||
		formModel.maxBudgetUsdt !== config.value.maxBudgetUsdt ||
		formModel.maxTeamPositions !== config.value.maxTeamPositions ||
		formModel.safetyMode !== (masterConfig.value?.safetyMode ?? "risk_plus_simulation") ||
		formModel.allowEphemeralStrategy !==
			(masterConfig.value?.allowEphemeralStrategy ?? true) ||
		formModel.legacySystemEnabled !==
			(masterConfig.value?.legacySystemEnabled ?? false)
	);
});

const canSave = computed(
	() => !loadError.value && isDirty.value && !loadingSave.value && !busy.value,
);

const normalizeConfig = (
	source: Partial<AgentTeamsConfigResponse> | null,
): AgentTeamsConfigResponse => ({
	enabled: Boolean(source?.enabled),
	intervalSeconds:
		typeof source?.intervalSeconds === "number" && source.intervalSeconds > 0
			? source.intervalSeconds
			: 30,
	maxBudgetUsdt:
		typeof source?.maxBudgetUsdt === "number" && source.maxBudgetUsdt > 0
			? source.maxBudgetUsdt
			: 200,
	maxTeamPositions:
		typeof source?.maxTeamPositions === "number" && source.maxTeamPositions > 0
			? source.maxTeamPositions
			: 3,
	updatedAt: source?.updatedAt,
});

const resetFormFromConfig = () => {
	if (!config.value) {
		return;
	}
	formModel.enabled = config.value.enabled;
	formModel.intervalSeconds = config.value.intervalSeconds;
	formModel.maxBudgetUsdt = config.value.maxBudgetUsdt;
	formModel.maxTeamPositions = config.value.maxTeamPositions;
	formModel.safetyMode = masterConfig.value?.safetyMode ?? "risk_plus_simulation";
	formModel.allowEphemeralStrategy =
		masterConfig.value?.allowEphemeralStrategy ?? true;
	formModel.legacySystemEnabled =
		masterConfig.value?.legacySystemEnabled ?? false;
};

const loadConfig = async () => {
	loadingInit.value = true;
	loadError.value = null;
	try {
		const [response, masterResponse] = await Promise.all([
			fetchAgentTeamsConfig(),
			fetchMasterConfig(),
		]);
		if (!response || !masterResponse) {
			loadError.value = "fetch_failed";
			ElMessage.error("无法获取配置，请检查后端服务");
			return;
		}

		const next = normalizeConfig(response);
		config.value = next;
		masterConfig.value = masterResponse;
		resetFormFromConfig();

		const incomplete =
			response.intervalSeconds === undefined ||
			response.maxBudgetUsdt === undefined ||
			response.maxTeamPositions === undefined ||
			response.enabled === undefined;
		if (incomplete) {
			ElMessage.warning("配置字段不完整，已使用默认值展示");
		}
	} catch (error) {
		loadError.value = "fetch_exception";
		ElMessage.error(
			error instanceof Error ? error.message : "配置加载失败，请稍后重试",
		);
	} finally {
		loadingInit.value = false;
	}
};

const saveConfig = async () => {
	if (!config.value) {
		return;
	}
	loadingSave.value = true;
	try {
		const payload = {
			enabled: formModel.enabled,
			intervalSeconds: formModel.intervalSeconds,
			maxBudgetUsdt: formModel.maxBudgetUsdt,
			maxTeamPositions: formModel.maxTeamPositions,
		};
		const [response, masterResponse] = await Promise.all([
			updateAgentTeamsConfig(payload),
			updateMasterConfig({
				safetyMode: formModel.safetyMode,
				allowEphemeralStrategy: formModel.allowEphemeralStrategy,
				legacySystemEnabled: formModel.legacySystemEnabled,
			}),
		]);
		if (!response || !masterResponse) {
			ElMessage.error("保存失败，请检查后端服务");
			return;
		}
		config.value = normalizeConfig(response);
		masterConfig.value = masterResponse;
		resetFormFromConfig();
		ElMessage.success("保存成功");
	} catch (error) {
		ElMessage.error(
			error instanceof Error ? error.message : "保存失败，请稍后重试",
		);
	} finally {
		loadingSave.value = false;
	}
};

const handleStart = async () => {
	loadingStart.value = true;
	try {
		const response = await startAgentTeams();
		if (!response?.success) {
			ElMessage.error("启动失败，请稍后重试");
			return;
		}
		ElMessage.success("Agent Teams 已启动");
		await loadConfig();
	} catch (error) {
		ElMessage.error(
			error instanceof Error ? error.message : "启动失败，请稍后重试",
		);
	} finally {
		loadingStart.value = false;
	}
};

const handleStop = async () => {
	loadingStop.value = true;
	try {
		const response = await stopAgentTeams();
		if (!response?.success) {
			ElMessage.error("停止失败，请稍后重试");
			return;
		}
		ElMessage.success("Agent Teams 已停止");
		await loadConfig();
	} catch (error) {
		ElMessage.error(
			error instanceof Error ? error.message : "停止失败，请稍后重试",
		);
	} finally {
		loadingStop.value = false;
	}
};

const formatTime = (value: string) =>
	new Date(value).toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

onMounted(() => {
	void loadConfig();
});
</script>

<style scoped>
.config-page :deep(.el-main) {
  padding: 80px 24px 32px;
}

.title-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-title {
  margin: 0;
  color: #111827;
  font-size: 24px;
  line-height: 1.2;
}

.page-subtitle {
  margin: 0;
  color: #6b7280;
}

.card {
  border: 1px solid #d1d5db;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-label {
  color: #374151;
  font-weight: 600;
}

.action-wrap {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.config-form {
  max-width: 720px;
}

.updated-at {
  color: #6b7280;
}

.hint-text {
  margin-left: 10px;
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 768px) {
  .action-wrap {
    justify-content: flex-start;
    margin-top: 12px;
    flex-wrap: wrap;
  }
}
</style>
