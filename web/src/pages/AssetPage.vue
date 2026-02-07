<template>
  <el-container class="asset-page">
    <el-main>
      <el-space direction="vertical" size="large" fill>
        <el-row :gutter="16">
          <el-col :xs="24">
            <el-card shadow="never">
              <template #header>
                <span>资产总览</span>
              </template>
              <el-statistic title="总资产 (USDT)" :value="Number(totalValue)" :precision="2" />
              <el-space size="small" class="value-change">
                <el-text :type="pnlType">{{ changeAmount }}</el-text>
                <el-text :type="pnlType">{{ changePercent }}</el-text>
              </el-space>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24">
            <EquityChart :history="history" />
          </el-col>
        </el-row>
      </el-space>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import EquityChart from "../components/EquityChart.vue";
import type { AccountData, HistoryEntry } from "../services/api";
import { fetchAccount, fetchHistory } from "../services/api";

const account = ref<AccountData | null>(null);
const history = ref<HistoryEntry[]>([]);

const totalValue = computed(() => {
	if (!account.value) {
		return "0.00";
	}

	const total = account.value.totalBalance + account.value.unrealisedPnl;
	return total.toFixed(2);
});

const totalPnl = computed(() => {
	if (!account.value) {
		return 0;
	}

	const total = account.value.totalBalance + account.value.unrealisedPnl;
	return total - account.value.initialBalance;
});

const changeAmount = computed(() => {
	const value = totalPnl.value;
	return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
});

const changePercent = computed(() => {
	if (!account.value || account.value.initialBalance === 0) {
		return "(+0.00%)";
	}

	const percent = (totalPnl.value / account.value.initialBalance) * 100;
	return `(${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%)`;
});

const pnlType = computed(() => (totalPnl.value >= 0 ? "danger" : "success"));

const loadAccount = async () => {
	const data = await fetchAccount();
	if (data) {
		account.value = data;
	}
};

const loadHistory = async () => {
	const data = await fetchHistory();
	if (data) {
		history.value = data.history || [];
	}
};

const loadInitialData = async () => {
	await Promise.all([loadAccount(), loadHistory()]);
};

const intervals: Array<() => void> = [];

onMounted(async () => {
	await loadInitialData();

	intervals.push(useIntervalFn(loadAccount, 3000, { immediate: false }).pause);
	intervals.push(useIntervalFn(loadHistory, 30000, { immediate: false }).pause);
});

onBeforeUnmount(() => {
	for (const pause of intervals) {
		pause();
	}
});
</script>

<style scoped>
.asset-page :deep(.el-main) {
  padding: 80px 24px 32px;
}

.asset-page :deep(.el-space) {
  width: 100%;
  display: flex;
}

.asset-page :deep(.el-space--vertical) {
  align-items: stretch;
}

.value-change {
  margin-top: 6px;
}
</style>
