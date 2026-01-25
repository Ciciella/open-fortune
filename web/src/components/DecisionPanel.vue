<template>
  <section class="chart-section">
    <div class="chart-header">
      <h3 class="decision-title">最新 AI 决策</h3>
      <div class="decision-meta">
        <span class="decision-time">{{ timeText }}</span>
        <span class="decision-iteration">{{ iterationText }}</span>
      </div>
    </div>
    <div class="decision-container">
      <div class="decision-content">
        <p v-if="loading" class="loading">加载 AI 决策中...</p>
        <p v-else-if="!html" class="no-data">暂无 AI 决策记录</p>
        <div v-else class="decision-text markdown-content" v-html="html"></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
	html: string;
	timeText: string;
	iterationText: string;
	loading: boolean;
}>();
</script>
