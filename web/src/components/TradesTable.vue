<template>
  <el-card shadow="never">
    <template #header>
      <el-space size="small">
        <span>交易历史</span>
        <el-tag v-if="trades.length" type="info" effect="plain">
          {{ trades.length }}
        </el-tag>
      </el-space>
    </template>
    <el-table
      :data="trades"
      size="small"
      v-loading="loading"
      :empty-text="loading ? '加载中...' : '暂无交易记录'"
    >
      <el-table-column label="时间" width="170">
        <template #default="{ row }">
          {{ formatTime(row.timestamp) }}
        </template>
      </el-table-column>
      <el-table-column label="开仓时间" width="170">
        <template #default="{ row }">
          {{ row.openTimestamp ? formatTime(row.openTimestamp) : "-" }}
        </template>
      </el-table-column>
      <el-table-column label="平仓时间" width="170">
        <template #default="{ row }">
          {{ row.closeTimestamp ? formatTime(row.closeTimestamp) : "-" }}
        </template>
      </el-table-column>
      <el-table-column label="持仓时长" width="120">
        <template #default="{ row }">
          {{ formatDuration(row.holdingDurationSec) }}
        </template>
      </el-table-column>
      <el-table-column prop="symbol" label="币种" width="90" />
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="row.type === 'open' ? 'success' : 'warning'" effect="plain">
            {{ row.type === "open" ? "开仓" : "平仓" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="方向" width="90">
        <template #default="{ row }">
          <el-tag :type="sideType(row.side)" effect="plain">
            {{ row.side === "long" ? "做多" : "做空" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="价格">
        <template #default="{ row }">
          {{ row.price.toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column prop="quantity" label="数量" />
      <el-table-column label="杠杆" width="80">
        <template #default="{ row }">
          {{ row.leverage }}x
        </template>
      </el-table-column>
      <el-table-column label="手续费">
        <template #default="{ row }">
          {{ row.fee.toFixed(4) }}
        </template>
      </el-table-column>
      <el-table-column label="盈亏">
        <template #default="{ row }">
          <el-text :type="pnlType(row)">
            {{ formatPnl(row) }}
          </el-text>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TradeData } from "../services/api";
import { formatDateTime } from "../utils/dateTime";

const props = defineProps<{
	trades: TradeData[];
	loading: boolean;
	isReversed: boolean;
}>();

const positiveType = computed(() => (props.isReversed ? "success" : "danger"));
const negativeType = computed(() => (props.isReversed ? "danger" : "success"));

const formatTime = (timestamp: string) => {
	return formatDateTime(timestamp);
};

const formatDuration = (seconds?: number | null) => {
	if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
		return "-";
	}
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainSeconds = seconds % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m ${remainSeconds}s`;
	}
	return `${minutes}m ${remainSeconds}s`;
};

const formatPnl = (trade: TradeData) => {
	if (trade.type === "close" && trade.pnl !== null && trade.pnl !== undefined) {
		return `${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}`;
	}

	return "-";
};

const pnlType = (trade: TradeData) => {
	if (trade.type !== "close" || trade.pnl === null || trade.pnl === undefined) {
		return "info";
	}

	return trade.pnl >= 0 ? positiveType.value : negativeType.value;
};

const sideType = (side: TradeData["side"]) =>
	side === "long" ? positiveType.value : negativeType.value;
</script>
