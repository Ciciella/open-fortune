<template>
  <el-container class="monitor-page">
    <el-main>
      <el-space direction="vertical" size="large" fill>
        <TickerBar :symbols="tickerSymbols" :prices="prices" />

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
import TickerBar from "../components/TickerBar.vue";
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
	fetchPrices,
	fetchStrategy,
	fetchTrades,
} from "../services/api";

const tickerSymbols = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP"];

const prices = ref<Record<string, number>>({});
const account = ref<AccountData | null>(null);
const strategy = ref<StrategyData | null>(null);
const positions = ref<PositionData[]>([]);
const trades = ref<TradeData[]>([]);
const logEntry = ref<LogEntry | null>(null);


const positionsLoading = ref(true);
const tradesLoading = ref(true);
const logsLoading = ref(true);

const password = useSessionStorage<string>("close_position_password", "");
const isLoggedIn = computed(() => password.value.length > 0);

const colorScheme = useLocalStorage<"default" | "reversed">(
	"colorScheme",
	"default",
);
const isReversed = computed(() => colorScheme.value === "reversed");

const showLoginModal = ref(false);
const isClosing = ref(false);

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

	const date = new Date(logEntry.value.timestamp);
	return date.toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
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
		await Promise.all([loadAccount(), loadPositions(), loadTrades()]);
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
		const nextPrices = { ...prices.value };
		for (const position of data.positions) {
			nextPrices[position.symbol] = position.currentPrice;
		}
		prices.value = nextPrices;
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

const loadPrices = async () => {
	const data = await fetchPrices(tickerSymbols);
	if (data) {
		prices.value = { ...prices.value, ...data.prices };
	}
};


const loadInitialData = async () => {
	await Promise.all([
		loadAccount(),
		loadPositions(),
		loadTrades(),
		loadLogs(),
		loadPrices(),
		loadStrategy(),
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
	intervals.push(useIntervalFn(loadPrices, 10000, { immediate: false }).pause);
	intervals.push(
		useIntervalFn(() => Promise.all([loadTrades(), loadLogs()]), 30000, {
			immediate: false,
		}).pause,
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
</style>
