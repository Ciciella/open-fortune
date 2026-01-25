<template>
  <div class="monitor-root">
    <HeaderBar />

    <TickerBar :symbols="tickerSymbols" :prices="prices" />

    <main class="main-content">
      <EquityChart :history="history" />

      <DecisionPanel
        :html="decisionHtml"
        :time-text="decisionTime"
        :iteration-text="decisionIteration"
        :loading="logsLoading"
      />

      <AccountPanel
        :account="account"
        :strategy="strategy"
        :positions="positions"
        :theme-label="themeLabel"
        :toggle-theme="toggleTheme"
      />

      <PositionsTable
        :positions="positions"
        :loading="positionsLoading"
        :is-logged-in="isLoggedIn"
        :is-closing="isClosing"
        :on-close="handleClosePosition"
        :on-login-click="handleLoginClick"
      />

      <TradesTable :trades="trades" :loading="tradesLoading" />
    </main>

    <LoginModal v-model="showLoginModal" @confirm="handleLogin" />

    <ToastContainer :toasts="toasts" @remove="removeToast" />
  </div>
</template>

<script setup lang="ts">
import {
	useIntervalFn,
	useLocalStorage,
	useSessionStorage,
} from "@vueuse/core";
import { marked } from "marked";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AccountPanel from "../components/AccountPanel.vue";
import DecisionPanel from "../components/DecisionPanel.vue";
import EquityChart from "../components/EquityChart.vue";
import HeaderBar from "../components/HeaderBar.vue";
import LoginModal from "../components/LoginModal.vue";
import PositionsTable from "../components/PositionsTable.vue";
import TickerBar from "../components/TickerBar.vue";
import ToastContainer, {
	type ToastItem,
	type ToastType,
} from "../components/ToastContainer.vue";
import TradesTable from "../components/TradesTable.vue";
import type {
	AccountData,
	HistoryEntry,
	LogEntry,
	PositionData,
	StrategyData,
	TradeData,
} from "../services/api";
import {
	closePosition,
	fetchAccount,
	fetchHistory,
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
const history = ref<HistoryEntry[]>([]);
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
const themeLabel = computed(() =>
	colorScheme.value === "reversed" ? "红跌绿涨" : "红涨绿跌",
);

const showLoginModal = ref(false);
const isClosing = ref(false);

const toasts = ref<ToastItem[]>([]);

const decisionHtml = computed(() => {
	if (!logEntry.value) {
		return "";
	}

	const decision =
		logEntry.value.decision || logEntry.value.actionsTaken || "暂无决策内容";
	return marked.parse(decision);
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

const addToast = (title: string, message: string, type: ToastType = "info") => {
	const id = `${Date.now()}-${Math.random()}`;
	const toast: ToastItem = { id, title, message, type };

	toasts.value = [...toasts.value, toast];

	const timeout = type === "success" ? 3000 : 5000;
	window.setTimeout(() => removeToast(id), timeout);
};

const removeToast = (id: string) => {
	toasts.value = toasts.value.filter((toast) => toast.id !== id);
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

const toggleTheme = () => {
	colorScheme.value = colorScheme.value === "reversed" ? "default" : "reversed";
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
		logEntry.value = data.logs[0];
	} else {
		logEntry.value = null;
	}
	logsLoading.value = false;
};

const loadHistory = async () => {
	const data = await fetchHistory();
	if (data) {
		history.value = data.history || [];
	}
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
		loadHistory(),
	]);
};

const applyBodyClasses = () => {
	const body = document.body;
	body.classList.add("monitor-body");
	if (colorScheme.value === "reversed") {
		body.classList.add("color-mode-reversed");
	} else {
		body.classList.remove("color-mode-reversed");
	}
};

watch(colorScheme, () => {
	applyBodyClasses();
});

const intervals: Array<() => void> = [];

onMounted(async () => {
	applyBodyClasses();
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
	intervals.push(useIntervalFn(loadHistory, 30000, { immediate: false }).pause);
});

onBeforeUnmount(() => {
	document.body.classList.remove("monitor-body", "color-mode-reversed");
	for (const pause of intervals) {
		pause();
	}
});
</script>

<style src="../styles/monitor.css"></style>
