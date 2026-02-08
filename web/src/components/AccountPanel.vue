<template>
  <el-card shadow="never">
    <template #header>
      <el-row justify="space-between" align="middle">
        <span>账户概览</span>
        <el-switch
          :model-value="isReversed"
          inline-prompt
          active-text="红跌绿涨"
          inactive-text="红涨绿跌"
          @change="onThemeChange"
        />
      </el-row>
    </template>

    <el-divider />

    <el-descriptions :column="1" size="small" border>
      <el-descriptions-item label="可用余额">{{ availableBalance }}</el-descriptions-item>
      <el-descriptions-item label="未实现盈亏">
        <el-text :type="unrealisedType">{{ unrealisedPnlText }}</el-text>
      </el-descriptions-item>
      <el-descriptions-item label="当前策略">
        <el-space size="small">
          <el-tag type="info" effect="plain">{{ strategyName }}</el-tag>
          <el-text size="small">{{ strategyInfo }}</el-text>
        </el-space>
      </el-descriptions-item>
    </el-descriptions>

    <el-divider />

    <el-table :data="positions" size="small" max-height="220" empty-text="暂无持仓">
      <el-table-column prop="symbol" label="币种" width="90" />
      <el-table-column label="来源" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="sourceTagType(row.openSource)">
            {{ row.openSource ?? "未知来源" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="方向" width="80">
        <template #default="{ row }">
          <el-tag :type="sideType(row.side)" effect="plain">
            {{ row.side === "long" ? "多" : "空" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="杠杆" width="80">
        <template #default="{ row }">
          {{ row.leverage ?? "-" }}x
        </template>
      </el-table-column>
      <el-table-column label="未实现盈亏">
        <template #default="{ row }">
          <el-text :type="pnlValueType(row.unrealizedPnl)">
            {{ formatPnl(row.unrealizedPnl) }}
          </el-text>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AccountData, PositionData, StrategyData } from "../services/api";

const props = defineProps<{
	account: AccountData | null;
	strategy: StrategyData | null;
	positions: PositionData[];
	isReversed: boolean;
	onThemeChange: (value: boolean) => void;
}>();

const unrealisedPnl = computed(() => props.account?.unrealisedPnl ?? 0);

const unrealisedPnlText = computed(() => {
	const value = unrealisedPnl.value;
	return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
});

const availableBalance = computed(() =>
	props.account ? props.account.availableBalance.toFixed(2) : "0.00",
);

const strategyName = computed(
	() => props.strategy?.strategyName ?? "加载中...",
);

const strategyInfo = computed(() => {
	if (!props.strategy) {
		return "-";
	}

	const protectionMode = props.strategy.enableCodeLevelProtection
		? "代码级"
		: "AI";
	return `${props.strategy.intervalMinutes}分 | ${props.strategy.leverageRange} | ${props.strategy.positionSizeRange} | ${protectionMode}`;
});

const positiveType = computed(() => (props.isReversed ? "success" : "danger"));
const negativeType = computed(() => (props.isReversed ? "danger" : "success"));
const unrealisedType = computed(() =>
	unrealisedPnl.value >= 0 ? positiveType.value : negativeType.value,
);

const formatPnl = (pnl: number) => `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;

const pnlValueType = (value: number) =>
	value >= 0 ? positiveType.value : negativeType.value;

const sideType = (side: PositionData["side"]) =>
	side === "long" ? positiveType.value : negativeType.value;

const sourceTagType = (source?: PositionData["openSource"]) => {
	if (source === "Agent Teams") return "success";
	if (source === "AI交易") return "info";
	if (source === "来源冲突") return "danger";
	return "warning";
};
</script>
