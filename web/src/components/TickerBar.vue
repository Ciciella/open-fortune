<template>
  <div class="ticker-wrapper">
    <div class="ticker-content" id="ticker">
      <div v-for="(symbol, index) in repeatedSymbols" :key="`${symbol}-${index}`" class="ticker-item">
        <span class="crypto-name">{{ symbol }}</span>
        <span class="crypto-price">{{ formatPrice(prices[symbol]) }}</span>
      </div>
    </div>
  </div>
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
