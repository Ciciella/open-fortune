<template>
  <el-card shadow="never">
    <el-space wrap>
      <el-tag
        v-for="(symbol, index) in repeatedSymbols"
        :key="`${symbol}-${index}`"
        type="info"
        effect="plain"
      >
        {{ symbol }} {{ formatPrice(prices[symbol]) }}
      </el-tag>
    </el-space>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
	symbols: string[];
	prices: Record<string, number>;
}>();

const repeatedSymbols = computed(() => [
	...props.symbols,
	...props.symbols,
	...props.symbols,
]);

const formatPrice = (price?: number) => {
	if (price === undefined) {
		return "--";
	}

	const decimals = price < 1 ? 4 : 2;
	return `$${price.toFixed(decimals)}`;
};
</script>
