<template>
  <section class="chart-section">
    <div class="chart-header">
      <h3 class="chart-title">资产曲线</h3>
    </div>
    <div class="chart-container">
      <canvas ref="canvasRef"></canvas>
      <div v-if="!hasData" class="no-data-overlay">
        暂无历史数据
        <br />
        <small style="color: #008866;">系统将每10分钟自动记录账户资产</small>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Chart, type ChartData, type ChartOptions } from "chart.js/auto";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { HistoryEntry } from "../services/api";

const props = defineProps<{
	history: HistoryEntry[];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const chartRef = ref<Chart | null>(null);

const hasData = computed(() => props.history.length > 0);

const buildLabels = (items: HistoryEntry[]) =>
	items.map((entry) => {
		const date = new Date(entry.timestamp);
		return date.toLocaleString("zh-CN", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	});

const buildDataset = (items: HistoryEntry[]) =>
	items.map((entry) => Number(entry.totalValue.toFixed(2)));

const initChart = () => {
	if (!canvasRef.value) {
		return;
	}

	const data: ChartData<"line"> = {
		labels: buildLabels(props.history),
		datasets: [
			{
				label: "总资产 (USDT)",
				data: buildDataset(props.history),
				borderColor: "rgb(0, 255, 170)",
				backgroundColor: "rgba(0, 255, 170, 0.1)",
				borderWidth: 2,
				fill: true,
				tension: 0.4,
				pointRadius: 0,
				pointHoverRadius: 0,
			},
		],
	};

	const options: ChartOptions<"line"> = {
		responsive: true,
		maintainAspectRatio: false,
		interaction: {
			intersect: false,
			mode: "index",
		},
		plugins: {
			legend: {
				display: true,
				position: "top",
				labels: {
					color: "#fff",
					usePointStyle: true,
					padding: 15,
				},
			},
			tooltip: {
				backgroundColor: "rgba(17, 24, 39, 0.95)",
				titleColor: "#fff",
				bodyColor: "#fff",
				borderColor: "rgb(59, 130, 246)",
				borderWidth: 1,
				padding: 12,
				displayColors: true,
				callbacks: {
					label: (context) => {
						let label = context.dataset.label || "";
						if (label) {
							label += ": ";
						}
						if (context.parsed.y !== null) {
							label += `$${context.parsed.y}`;
						}
						return label;
					},
				},
			},
		},
		scales: {
			x: {
				display: true,
				grid: {
					color: "rgba(255, 255, 255, 0.1)",
					drawBorder: false,
				},
				ticks: {
					color: "#9ca3af",
					maxRotation: 45,
					minRotation: 0,
					maxTicksLimit: 10,
				},
			},
			y: {
				display: true,
				position: "left",
				grid: {
					color: "rgba(255, 255, 255, 0.1)",
					drawBorder: false,
				},
				ticks: {
					color: "#9ca3af",
					callback: (value) => `$${Number(value).toFixed(2)}`,
				},
			},
		},
	};

	chartRef.value = new Chart(canvasRef.value, {
		type: "line",
		data,
		options,
	});
};

const updateChart = () => {
	if (!chartRef.value) {
		initChart();
		return;
	}

	chartRef.value.data.labels = buildLabels(props.history);
	chartRef.value.data.datasets[0].data = buildDataset(props.history);
	chartRef.value.data.datasets[0].pointRadius = 0;
	chartRef.value.update("none");
};

watch(
	() => props.history,
	() => {
		if (props.history.length > 0) {
			updateChart();
		}
	},
	{ deep: true },
);

onMounted(() => {
	if (props.history.length > 0) {
		initChart();
	}
});

onBeforeUnmount(() => {
	if (chartRef.value) {
		chartRef.value.destroy();
		chartRef.value = null;
	}
});
</script>

<style scoped>
.no-data-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #00cc88;
  text-align: center;
}
</style>
