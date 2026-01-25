<template>
  <section class="trades-section">
    <h2 class="section-header">
      交易历史
      <span id="tradesCount">{{ trades.length ? `(${trades.length})` : '' }}</span>
    </h2>
    <div class="trades-container">
      <table class="trades-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>币种</th>
            <th>类型</th>
            <th>方向</th>
            <th>价格</th>
            <th>数量</th>
            <th>杠杆</th>
            <th>手续费</th>
            <th>盈亏</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" class="loading">加载中...</td>
          </tr>
          <tr v-else-if="trades.length === 0">
            <td colspan="9" class="empty-state">暂无交易记录</td>
          </tr>
          <tr v-for="trade in trades" v-else :key="trade.timestamp + trade.symbol + trade.type">
            <td>{{ formatTime(trade.timestamp) }}</td>
            <td><span class="symbol">{{ trade.symbol }}</span></td>
            <td>
              <span class="type" :class="trade.type === 'open' ? 'buy' : 'sell'">
                {{ trade.type === 'open' ? '开仓' : '平仓' }}
              </span>
            </td>
            <td>
              <span class="side" :class="trade.side === 'long' ? 'long' : 'short'">
                {{ trade.side === 'long' ? '做多' : '做空' }}
              </span>
            </td>
            <td>{{ trade.price.toFixed(2) }}</td>
            <td>{{ trade.quantity }}</td>
            <td>{{ trade.leverage }}x</td>
            <td>{{ trade.fee.toFixed(4) }}</td>
            <td v-html="formatPnl(trade)"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TradeData } from "../services/api";

defineProps<{
	trades: TradeData[];
	loading: boolean;
}>();

const formatTime = (timestamp: string) => {
	const date = new Date(timestamp);
	return date.toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
};

const formatPnl = (trade: TradeData) => {
	if (trade.type === "close" && trade.pnl !== null && trade.pnl !== undefined) {
		const cls = trade.pnl >= 0 ? "profit" : "loss";
		const value = `${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}`;
		return `<span class="${cls}">${value}</span>`;
	}

	return '<span class="na">-</span>';
};
</script>
