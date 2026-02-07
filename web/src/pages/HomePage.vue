<template>
  <el-container class="home-page">
    <el-main>
      <el-space direction="vertical" size="large" fill>
        <TickerBar :symbols="tickerSymbols" :prices="prices" />
      </el-space>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { onBeforeUnmount, onMounted, ref } from "vue";
import TickerBar from "../components/TickerBar.vue";
import { fetchPrices } from "../services/api";

const tickerSymbols = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP"];

const prices = ref<Record<string, number>>({});

const loadPrices = async () => {
	const data = await fetchPrices(tickerSymbols);
	if (data) {
		prices.value = { ...prices.value, ...data.prices };
	}
};

const loadInitialData = async () => {
	await loadPrices();
};

const intervals: Array<() => void> = [];

onMounted(async () => {
	await loadInitialData();

	intervals.push(useIntervalFn(loadPrices, 10000, { immediate: false }).pause);
});

onBeforeUnmount(() => {
	for (const pause of intervals) {
		pause();
	}
});
</script>

<style scoped>
.home-page :deep(.el-main) {
  padding: 80px 24px 32px;
}

.home-page :deep(.el-space) {
  width: 100%;
  display: flex;
}

.home-page :deep(.el-space--vertical) {
  align-items: stretch;
}
</style>
