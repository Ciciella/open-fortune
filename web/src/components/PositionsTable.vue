<template>
  <section class="positions-section">
    <div class="section-header-with-action">
      <h2 class="section-header">当前持仓</h2>
      <button class="btn-login" :class="{ 'logged-in': isLoggedIn }" @click="onLoginClick">
        {{ isLoggedIn ? '退出' : '登录' }}
      </button>
    </div>
    <div class="positions-container">
      <table class="positions-table">
        <thead>
          <tr>
            <th>币种</th>
            <th>方向</th>
            <th>开仓倍数</th>
            <th>开仓价格</th>
            <th>开仓价值</th>
            <th>当前价格</th>
            <th>未实现盈亏</th>
            <th>收益率</th>
            <th class="th-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" class="loading">加载中...</td>
          </tr>
          <tr v-else-if="positions.length === 0">
            <td colspan="9" class="empty-state">暂无持仓</td>
          </tr>
          <tr v-for="position in positions" v-else :key="position.symbol">
            <td>{{ position.symbol }}</td>
            <td :class="position.side === 'long' ? 'positive' : 'negative'">
              {{ position.side === 'long' ? '做多' : '做空' }}
            </td>
            <td>{{ position.leverage ?? '-' }}x</td>
            <td>${{ position.entryPrice.toFixed(4) }}</td>
            <td>${{ position.openValue.toFixed(2) }}</td>
            <td>${{ position.currentPrice.toFixed(4) }}</td>
            <td :class="position.unrealizedPnl >= 0 ? 'positive' : 'negative'">
              {{ formatPnl(position.unrealizedPnl) }}
            </td>
            <td :class="position.unrealizedPnl >= 0 ? 'positive' : 'negative'">
              {{ formatPercent(position) }}
            </td>
            <td class="td-actions">
              <button
                v-if="isLoggedIn"
                class="btn-close-position"
                :disabled="isClosing"
                @click="onClose(position.symbol)"
              >
                平仓
              </button>
              <span v-else style="color: var(--text-dim); font-size: 0.75rem;">未登录</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PositionData } from "../services/api";

defineProps<{
	positions: PositionData[];
	loading: boolean;
	isLoggedIn: boolean;
	isClosing: boolean;
	onClose: (symbol: string) => void;
	onLoginClick: () => void;
}>();

const formatPnl = (pnl: number) => `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;

const formatPercent = (position: PositionData) => {
	const percent =
		position.openValue === 0
			? 0
			: (position.unrealizedPnl / position.openValue) * 100;
	return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
};
</script>
