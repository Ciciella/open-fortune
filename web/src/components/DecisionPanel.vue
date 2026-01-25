<template>
  <el-card shadow="never">
    <template #header>
      <el-row justify="space-between" align="middle">
        <el-col>
          <span>最新 AI 决策</span>
        </el-col>
        <el-col>
          <el-space size="small">
            <el-text size="small">{{ timeText }}</el-text>
            <el-tag type="info" effect="plain">{{ iterationText }}</el-tag>
          </el-space>
        </el-col>
      </el-row>
    </template>
    <el-skeleton v-if="loading" :rows="6" animated />
    <el-empty v-else-if="!html" description="暂无 AI 决策记录" />
    <div v-else class="decision-text markdown-content" v-html="html"></div>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
	html: string;
	timeText: string;
	iterationText: string;
	loading: boolean;
}>();
</script>

<style scoped>
.decision-text {
  line-height: 1.7;
  font-size: 14px;
}

.decision-text :deep(h1),
.decision-text :deep(h2),
.decision-text :deep(h3),
.decision-text :deep(h4),
.decision-text :deep(h5),
.decision-text :deep(h6) {
  margin: 1em 0 0.5em;
}

.decision-text :deep(p) {
  margin: 0.6em 0;
}

.decision-text :deep(code) {
  font-family: "Courier New", monospace;
}

.decision-text :deep(pre) {
  padding: 0.8em;
  border-radius: 6px;
  background: #f6f8fa;
}
</style>
