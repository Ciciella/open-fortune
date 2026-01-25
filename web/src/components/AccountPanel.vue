<template>
  <section class="account-section">
    <div class="account-header">
      <h2>总资产</h2>
      <div class="theme-toggle-btn" role="button" tabindex="0" @click="toggleTheme">
        <span>THEME: {{ themeLabel }}</span>
      </div>
    </div>
    <div class="account-value">
      <span class="currency-symbol">$</span>
      <span class="value-amount">{{ totalValue }}</span>
    </div>
    <div class="value-change">
      <span class="change-amount" :class="{ negative: totalPnl < 0 }">{{ changeAmount }}</span>
      <span class="change-percent" :class="changePercentClass">{{ changePercent }}</span>
    </div>
    <div class="account-details">
      <div class="detail-item">
        <span class="detail-label">可用余额</span>
        <span class="detail-value">{{ availableBalance }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">未实现盈亏</span>
        <span class="detail-value" :class="{ positive: unrealisedPnl >= 0, negative: unrealisedPnl < 0 }">
          {{ unrealisedPnlText }}
        </span>
      </div>
      <div class="detail-item">
        <span class="detail-label">当前策略</span>
        <span class="detail-value strategy-value">
          <span class="strategy-badge-inline" :class="strategyClass">{{ strategyName }}</span>
          <span class="strategy-info-inline">{{ strategyInfo }}</span>
        </span>
      </div>
    </div>

    <div class="positions-cards">
      <div class="positions-cards-header">
        <span class="positions-cards-title">当前持仓</span>
      </div>
      <div class="positions-cards-container">
        <div v-if="positions.length === 0" class="positions-cards-empty">暂无持仓</div>
        <div
          v-for="position in positions"
          v-else
          :key="position.symbol"
          class="position-card"
          :class="[position.side, position.unrealizedPnl >= 0 ? 'positive' : 'negative']"
        >
          <span class="position-card-symbol">{{ position.symbol }} {{ position.leverage || '-' }}x</span>
          <span class="position-card-pnl" :class="position.unrealizedPnl >= 0 ? 'positive' : 'negative'">
            {{ position.side === 'long' ? '多' : '空' }} {{ formatPnl(position.unrealizedPnl) }} ({{ formatPercent(position) }})
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AccountData, PositionData, StrategyData } from "../services/api";

const props = defineProps<{
	account: AccountData | null;
	strategy: StrategyData | null;
	positions: PositionData[];
	themeLabel: string;
	toggleTheme: () => void;
}>();

const totalValue = computed(() => {
	if (!props.account) {
		return "0.00";
	}

	const total = props.account.totalBalance + props.account.unrealisedPnl;
	return total.toFixed(2);
});

const unrealisedPnl = computed(() => props.account?.unrealisedPnl ?? 0);

const unrealisedPnlText = computed(() => {
	const value = unrealisedPnl.value;
	return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
});

const totalPnl = computed(() => {
	if (!props.account) {
		return 0;
	}

	const total = props.account.totalBalance + props.account.unrealisedPnl;
	return total - props.account.initialBalance;
});

const changeAmount = computed(() => {
	const value = totalPnl.value;
	return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
});

const changePercent = computed(() => {
	if (!props.account || props.account.initialBalance === 0) {
		return "(+0.00%)";
	}

	const percent = (totalPnl.value / props.account.initialBalance) * 100;
	return `(${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%)`;
});

const changePercentClass = computed(() => ({
	positive: totalPnl.value >= 0,
	negative: totalPnl.value < 0,
}));

const availableBalance = computed(() =>
	props.account ? props.account.availableBalance.toFixed(2) : "0.00",
);

const strategyName = computed(
	() => props.strategy?.strategyName ?? "加载中...",
);
const strategyClass = computed(() => props.strategy?.strategy ?? "");

const strategyInfo = computed(() => {
	if (!props.strategy) {
		return "-";
	}

	const protectionMode = props.strategy.enableCodeLevelProtection
		? "代码级"
		: "AI";
	return `${props.strategy.intervalMinutes}分 | ${props.strategy.leverageRange} | ${props.strategy.positionSizeRange} | ${protectionMode}`;
});

const formatPnl = (pnl: number) => `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;

const formatPercent = (position: PositionData) => {
	const percent =
		position.openValue === 0
			? 0
			: (position.unrealizedPnl / position.openValue) * 100;
	return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
};
</script>
