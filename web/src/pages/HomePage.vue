<template>
  <el-container class="home-page">
    <el-main>
      <el-space direction="vertical" size="large" fill>
        <section class="hero">
          <div class="hero-glow hero-glow-a" />
          <div class="hero-glow hero-glow-b" />
          <div class="hero-grid" />

          <el-row :gutter="20" align="middle">
            <el-col :xs="24" :lg="15">
              <div class="hero-content">
                <el-tag effect="dark" class="hero-tag">AI Trading Console</el-tag>
                <h1 class="hero-title">open-fortune</h1>
                <p class="hero-subtitle">
                  一个面向实盘与策略验证的 AI 交易控制台，整合行情监控、决策记录、风险控制和执行链路，
                  帮助你更直观地管理自动化交易系统。
                </p>
                <el-space wrap>
                  <router-link to="/trade" class="hero-link">
                    <el-button type="primary" size="large">进入 AI交易</el-button>
                  </router-link>
                  <router-link to="/assets" class="hero-link">
                    <el-button size="large" plain>查看资产页</el-button>
                  </router-link>
                </el-space>
              </div>
            </el-col>
            <el-col :xs="24" :lg="9">
              <el-card shadow="hover" class="hero-status-card">
                <div class="status-head">
                  <span class="status-title">系统特性</span>
                  <span class="pulse-dot" />
                </div>
                <ul class="status-list">
                  <li>多模块分离：首页 / AI交易 / 资产 / 配置</li>
                  <li>实时行情轮询 + 决策日志追踪</li>
                  <li>Agent Teams 与 AI交易互斥保护</li>
                </ul>
              </el-card>
            </el-col>
          </el-row>
        </section>

        <TickerBar :symbols="tickerSymbols" :prices="prices" />

        <section class="feature-section">
          <el-row :gutter="16">
            <el-col :xs="24" :md="8">
              <el-card shadow="hover" class="feature-card">
                <div class="feature-icon">01</div>
                <h3>策略执行可见</h3>
                <p>从持仓、成交到 AI 决策结果统一展示，便于快速定位策略行为与执行偏差。</p>
              </el-card>
            </el-col>
            <el-col :xs="24" :md="8">
              <el-card shadow="hover" class="feature-card">
                <div class="feature-icon">02</div>
                <h3>资产表现直观</h3>
                <p>独立资产页提供总资产与曲线趋势，支持快速观察账户资金状态变化。</p>
              </el-card>
            </el-col>
            <el-col :xs="24" :md="8">
              <el-card shadow="hover" class="feature-card">
                <div class="feature-icon">03</div>
                <h3>风险边界明确</h3>
                <p>通过配置开关和状态同步机制，降低多策略并发冲突带来的交易风险。</p>
              </el-card>
            </el-col>
          </el-row>
        </section>
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

.hero {
  position: relative;
  overflow: hidden;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 28px;
  background: radial-gradient(circle at 10% 15%, rgba(23, 214, 166, 0.14), transparent 42%),
    radial-gradient(circle at 85% 85%, rgba(47, 137, 255, 0.14), transparent 40%),
    linear-gradient(145deg, #0b1017 0%, #090d14 100%);
}

.hero-grid {
  position: absolute;
  inset: 0;
  opacity: 0.2;
  background-image: linear-gradient(rgba(74, 85, 104, 0.35) 1px, transparent 1px),
    linear-gradient(90deg, rgba(74, 85, 104, 0.35) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle at center, black 25%, transparent 85%);
  pointer-events: none;
}

.hero-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(16px);
  opacity: 0.7;
  animation: floatGlow 6s ease-in-out infinite;
}

.hero-glow-a {
  width: 180px;
  height: 180px;
  background: rgba(23, 214, 166, 0.28);
  top: -42px;
  left: -22px;
}

.hero-glow-b {
  width: 220px;
  height: 220px;
  background: rgba(47, 137, 255, 0.25);
  right: -44px;
  bottom: -66px;
  animation-delay: 1.2s;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-tag {
  background: #0f1720;
  border-color: #2c3f52;
  color: #9fd7ff;
}

.hero-title {
  margin: 12px 0 8px;
  color: #f8fafc;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1.05;
  letter-spacing: 0.8px;
}

.hero-subtitle {
  margin: 0 0 20px;
  color: #b9c5d3;
  max-width: 720px;
  line-height: 1.7;
}

.hero-link {
  text-decoration: none;
}

.hero-status-card {
  position: relative;
  z-index: 1;
  border: 1px solid #213041;
  background: rgba(8, 12, 18, 0.85);
}

.status-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.status-title {
  font-weight: 700;
  color: #dbeafe;
}

.pulse-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #17d6a6;
  box-shadow: 0 0 0 0 rgba(23, 214, 166, 0.7);
  animation: pulse 1.8s infinite;
}

.status-list {
  margin: 0;
  padding-left: 18px;
  color: #b9c5d3;
  line-height: 1.7;
}

.feature-section {
  margin-top: 4px;
}

.feature-card {
  height: 100%;
  border: 1px solid #d5d9df;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
}

.feature-icon {
  font-family: "JetBrains Mono", monospace;
  font-weight: 700;
  color: #0f7bff;
  margin-bottom: 8px;
}

.feature-card h3 {
  margin: 0 0 8px;
  color: #0f172a;
}

.feature-card p {
  margin: 0;
  color: #475569;
  line-height: 1.65;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(23, 214, 166, 0.7);
  }
  70% {
    box-shadow: 0 0 0 9px rgba(23, 214, 166, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(23, 214, 166, 0);
  }
}

@keyframes floatGlow {
  0% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(10px) scale(1.06);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 768px) {
  .hero {
    padding: 20px;
  }

  .hero-subtitle {
    font-size: 14px;
  }
}
</style>
