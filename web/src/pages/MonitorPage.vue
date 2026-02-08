<template>
  <el-container class="monitor-page">
    <el-main>
      <el-space direction="vertical" size="large" fill>
        <el-row :gutter="16">
          <el-col :xs="24">
            <el-card shadow="never" class="status-card">
              <el-row justify="space-between" align="middle" :gutter="12">
                <el-col :xs="24" :md="12">
                  <el-space size="small">
                    <el-text class="status-label">当前AI交易状态</el-text>
                    <el-tag :type="aiTradeStatusTagType" size="large">
                      {{ aiTradeStatusText }}
                    </el-tag>
                  </el-space>
                </el-col>
                <el-col :xs="24" :md="12" class="status-actions">
                  <el-space size="small">
                    <el-text size="small" type="info">
                      该状态由 Agent Teams 开关反向推导（两者互斥）
                    </el-text>
                    <el-button
                      :loading="statusLoading"
                      @click="handleRefreshAiTradeStatus"
                    >
                      刷新状态
                    </el-button>
                  </el-space>
                </el-col>
              </el-row>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24">
            <AccountPanel
              :account="account"
              :strategy="strategy"
              :positions="positions"
              :is-reversed="isReversed"
              :on-theme-change="handleThemeChange"
            />
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24">
            <DecisionPanel
              :html="decisionHtml"
              :time-text="decisionTime"
              :iteration-text="decisionIteration"
              :loading="logsLoading"
            />
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24">
            <PositionsTable
              :positions="positions"
              :loading="positionsLoading"
              :is-logged-in="isLoggedIn"
              :is-closing="isClosing"
              :is-reversed="isReversed"
              :on-close="handleClosePosition"
              :on-login-click="handleLoginClick"
            />
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24">
            <TradesTable
              :trades="trades"
              :loading="tradesLoading"
              :is-reversed="isReversed"
            />
          </el-col>
        </el-row>
      </el-space>
    </el-main>

    <LoginModal v-model="showLoginModal" @confirm="handleLogin" />
  </el-container>
</template>

<script setup lang="ts">
import {
	useIntervalFn,
	useLocalStorage,
	useSessionStorage,
} from "@vueuse/core";
import { ElMessage } from "element-plus";
import { marked } from "marked";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AccountPanel from "../components/AccountPanel.vue";
import DecisionPanel from "../components/DecisionPanel.vue";
import LoginModal from "../components/LoginModal.vue";
import PositionsTable from "../components/PositionsTable.vue";
import TradesTable from "../components/TradesTable.vue";
import type {
	AccountData,
	LogEntry,
	PositionData,
	StrategyData,
	TradeData,
} from "../services/api";
import {
	closePosition,
	fetchAccount,
	fetchLogs,
	fetchPositions,
	fetchStrategy,
	fetchTrades,
} from "../services/api";
import { fetchAgentTeamsConfig } from "../services/agentTeams";
import { formatDateTime } from "../utils/dateTime";

const account = ref<AccountData | null>(null);
const strategy = ref<StrategyData | null>(null);
const positions = ref<PositionData[]>([]);
const trades = ref<TradeData[]>([]);
const positionsLoading = ref(true);
const tradesLoading = ref(true);
const logsLoading = ref(true);
const logEntry = ref<LogEntry | null>(null);
const agentTeamsEnabled = ref<boolean | null>(null);
const statusLoading = ref(false);

const password = useSessionStorage<string>("close_position_password", "");
const isLoggedIn = computed(() => password.value.length > 0);

const colorScheme = useLocalStorage<"default" | "reversed">(
	"colorScheme",
	"default",
);
const isReversed = computed(() => colorScheme.value === "reversed");

const showLoginModal = ref(false);
const isClosing = ref(false);

const aiTradeActive = computed(() => {
	if (agentTeamsEnabled.value === null) {
		return null;
	}
	return !agentTeamsEnabled.value;
});

const aiTradeStatusText = computed(() => {
	if (aiTradeActive.value === null) {
		return "状态未知";
	}
	return aiTradeActive.value ? "激活中" : "已关闭";
});

const aiTradeStatusTagType = computed<"success" | "info" | "warning">(() => {
	if (aiTradeActive.value === null) {
		return "warning";
	}
	return aiTradeActive.value ? "success" : "info";
});

const decisionHtml = computed(() => {
	if (!logEntry.value) {
		return "";
	}

	const decision =
		logEntry.value.decision || logEntry.value.actionsTaken || "暂无决策内容";
	const rendered = marked.parse(decision);
	return typeof rendered === "string" ? rendered : "";
});

const decisionTime = computed(() => {
	if (!logEntry.value) {
		return logsLoading.value ? "加载中..." : "无数据";
	}

	return formatDateTime(logEntry.value.timestamp);
});

const decisionIteration = computed(() => {
	if (!logEntry.value) {
		return "#-";
	}
	return `#${logEntry.value.iteration}`;
});

const addToast = (
	title: string,
	message: string,
	type: "success" | "error" | "warning" | "info" = "info",
) => {
	ElMessage({
		type,
		message: `${title}：${message}`,
		duration: type === "success" ? 3000 : 5000,
		showClose: true,
	});
};

const handleLoginClick = () => {
	if (isLoggedIn.value) {
		password.value = "";
		addToast("已退出", "已退出登录状态", "info");
		return;
	}

	showLoginModal.value = true;
};

const handleLogin = (value: string) => {
	password.value = value;
	addToast("登录成功", "现在可以进行平仓操作了", "success");
};

const handleThemeChange = (value: boolean) => {
	colorScheme.value = value ? "reversed" : "default";
};

const handleClosePosition = async (symbol: string) => {
	if (!isLoggedIn.value) {
		addToast("未登录", "请先登录后再进行平仓操作", "warning");
		return;
	}

	isClosing.value = true;

	const response = await closePosition(symbol, password.value);

	if (response.data.success && response.data.data) {
		const pnl = response.data.data.pnl;
		const pnlText = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);
		addToast("平仓成功", `${symbol} 已平仓，盈亏: ${pnlText} USDT`, "success");
		await Promise.all([loadPositions(), loadTrades()]);
	} else if (response.status === 403) {
		addToast("密码错误", "密码验证失败，已自动退出登录", "error");
		password.value = "";
	} else {
		addToast("平仓失败", response.data.message ?? "请求失败", "error");
	}

	isClosing.value = false;
};

const loadAccount = async () => {
	const data = await fetchAccount();
	if (data) {
		account.value = data;
	}
};

const loadStrategy = async () => {
	const data = await fetchStrategy();
	if (data) {
		strategy.value = data;
	}
};

const loadPositions = async () => {
	positionsLoading.value = true;
	const data = await fetchPositions();
	if (data) {
		positions.value = data.positions || [];
	}
	positionsLoading.value = false;
};

const loadTrades = async () => {
	tradesLoading.value = true;
	const data = await fetchTrades();
	if (data) {
		trades.value = data.trades || [];
	}
	tradesLoading.value = false;
};

const loadLogs = async () => {
	logsLoading.value = true;
	const data = await fetchLogs();
	if (data && data.logs.length > 0) {
		logEntry.value = data.logs[0] ?? null;
	} else {
		logEntry.value = null;
	}
	logsLoading.value = false;
};

const loadAiTradeStatus = async (manual = false) => {
	statusLoading.value = true;
	try {
		const response = await fetchAgentTeamsConfig();
		if (!response) {
			agentTeamsEnabled.value = null;
			if (manual) {
				ElMessage.warning("状态刷新失败");
			}
			return;
		}
		agentTeamsEnabled.value = response.enabled;
	} catch {
		agentTeamsEnabled.value = null;
		if (manual) {
			ElMessage.warning("状态刷新失败");
		}
	} finally {
		statusLoading.value = false;
	}
};

const handleRefreshAiTradeStatus = async () => {
	await loadAiTradeStatus(true);
};

const loadInitialData = async () => {
	await Promise.all([
		loadAccount(),
		loadStrategy(),
		loadPositions(),
		loadTrades(),
		loadLogs(),
		loadAiTradeStatus(),
	]);
};

const intervals: Array<() => void> = [];

onMounted(async () => {
	await loadInitialData();

	intervals.push(
		useIntervalFn(() => Promise.all([loadAccount(), loadPositions()]), 3000, {
			immediate: false,
		}).pause,
	);
	intervals.push(
		useIntervalFn(loadTrades, 30000, {
			immediate: false,
		}).pause,
	);
	intervals.push(useIntervalFn(loadLogs, 30000, { immediate: false }).pause);
	intervals.push(
		useIntervalFn(loadAiTradeStatus, 30000, { immediate: false }).pause,
	);
});

onBeforeUnmount(() => {
	for (const pause of intervals) {
		pause();
	}
});
</script>
<style scoped>
.monitor-page :deep(.el-main) {
  padding: 80px 24px 32px;
}

.monitor-page :deep(.el-space) {
  width: 100%;
  display: flex;
}

.monitor-page :deep(.el-space--vertical) {
  align-items: stretch;
}

.status-card {
  border: 1px solid #d1d5db;
}

.status-label {
  color: #111827;
  font-weight: 600;
}

.status-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .status-actions {
    justify-content: flex-start;
    margin-top: 8px;
  }
}
</style>
