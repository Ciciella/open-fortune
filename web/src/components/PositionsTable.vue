<template>
  <el-card shadow="never">
    <template #header>
      <el-row justify="space-between" align="middle">
        <span>当前持仓</span>
        <el-button
          size="small"
          :type="isLoggedIn ? 'warning' : 'primary'"
          @click="onLoginClick"
        >
          {{ isLoggedIn ? "退出" : "登录" }}
        </el-button>
      </el-row>
    </template>
    <el-table
      :data="positions"
      size="small"
      v-loading="loading"
      :empty-text="loading ? '加载中...' : '暂无持仓'"
    >
      <el-table-column prop="symbol" label="币种" width="90" />
      <el-table-column label="方向" width="90">
        <template #default="{ row }">
          <el-tag :type="sideType(row.side)" effect="plain">
            {{ row.side === "long" ? "做多" : "做空" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="开仓倍数" width="100">
        <template #default="{ row }">
          {{ row.leverage ?? "-" }}x
        </template>
      </el-table-column>
      <el-table-column label="开仓价格">
        <template #default="{ row }">
          ${{ row.entryPrice.toFixed(4) }}
        </template>
      </el-table-column>
      <el-table-column label="开仓价值">
        <template #default="{ row }">
          ${{ row.openValue.toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column label="当前价格">
        <template #default="{ row }">
          ${{ row.currentPrice.toFixed(4) }}
        </template>
      </el-table-column>
      <el-table-column label="未实现盈亏">
        <template #default="{ row }">
          <el-text :type="pnlValueType(row.unrealizedPnl)">
            {{ formatPnl(row.unrealizedPnl) }}
          </el-text>
        </template>
      </el-table-column>
      <el-table-column label="收益率">
        <template #default="{ row }">
          <el-text :type="pnlValueType(row.unrealizedPnl)">
            {{ formatPercent(row) }}
          </el-text>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button
            v-if="isLoggedIn"
            size="small"
            type="danger"
            :disabled="isClosing"
            @click="onClose(row.symbol)"
          >
            平仓
          </el-button>
          <el-text v-else type="info">未登录</el-text>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PositionData } from "../services/api";

const props = defineProps<{
	positions: PositionData[];
	loading: boolean;
	isLoggedIn: boolean;
	isClosing: boolean;
	isReversed: boolean;
	onClose: (symbol: string) => void;
	onLoginClick: () => void;
}>();

const positiveType = computed(() => (props.isReversed ? "success" : "danger"));
const negativeType = computed(() => (props.isReversed ? "danger" : "success"));

const formatPnl = (pnl: number) => `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;

const formatPercent = (position: PositionData) => {
	const percent =
		position.openValue === 0
			? 0
			: (position.unrealizedPnl / position.openValue) * 100;
	return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
};

const pnlValueType = (value: number) =>
	value >= 0 ? positiveType.value : negativeType.value;

const sideType = (side: PositionData["side"]) =>
	side === "long" ? positiveType.value : negativeType.value;
</script>
