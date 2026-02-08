<template>
  <el-container class="docs-page">
    <el-main>
      <el-space direction="vertical" size="middle" fill>
        <section class="hero">
          <h2 class="page-title">项目文档</h2>
          <p class="page-subtitle">open-fortune 功能介绍、模块结构与使用说明</p>
        </section>

        <el-card shadow="never" class="doc-card">
          <template #header>
            <div class="card-title">项目定位</div>
          </template>
          <p>
            open-fortune 是一个前后端分离的 AI 交易系统，提供 AI 交易、Agent Teams 协作决策、资产监控与系统配置能力，
            目标是在可控风险下提升交易执行效率与可解释性。
          </p>
        </el-card>

        <el-card shadow="never" class="doc-card">
          <template #header>
            <div class="card-title">核心功能</div>
          </template>
          <ul class="doc-list">
            <li>AI交易：持仓监控、手动平仓、交易历史回溯。</li>
            <li>Agent Teams：Master 总控 + 子智能体协作 + 结构化决策展示。</li>
            <li>资产页：账户净值、收益曲线与交易统计。</li>
            <li>配置页：运行开关、预算、风控与执行相关参数配置。</li>
            <li>AI 对话：辅助分析市场与策略思路。</li>
          </ul>
        </el-card>

        <el-card shadow="never" class="doc-card">
          <template #header>
            <div class="card-title">模块结构</div>
          </template>
          <ul class="doc-list">
            <li><code>api/</code>：后端 API、调度、交易执行、数据库与策略逻辑。</li>
            <li><code>web/</code>：Vue 3 前端页面、组件、路由和接口封装。</li>
            <li><code>docs/</code>：额外说明文档与资源文件。</li>
          </ul>
        </el-card>

        <el-card shadow="never" class="doc-card">
          <template #header>
            <div class="card-title">快速开始</div>
          </template>
          <ol class="doc-list">
            <li>配置后端环境变量（如交易所密钥、平仓密码）。</li>
            <li>启动后端：<code>npm --prefix api run dev</code>。</li>
            <li>启动前端：<code>npm --prefix web run dev</code>。</li>
            <li>先在测试网验证，再考虑实盘运行。</li>
          </ol>
        </el-card>

        <el-card shadow="never" class="doc-card warning-card">
          <template #header>
            <div class="card-title">风险提示</div>
          </template>
          <ul class="doc-list">
            <li>请勿提交任何 API 密钥与敏感配置。</li>
            <li>开启自动交易前，务必核对风控参数与杠杆限制。</li>
            <li>建议优先使用小资金和测试网进行验证。</li>
          </ul>
        </el-card>
      </el-space>
    </el-main>
  </el-container>
</template>

<script setup lang="ts"></script>

<style scoped>
.docs-page :deep(.el-main) {
  padding: 80px 24px 24px;
}

.hero {
  margin-bottom: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
  color: #111827;
}

.page-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
}

.doc-card {
  border: 1px solid #d1d5db;
}

.card-title {
  font-weight: 700;
  color: #111827;
}

.doc-list {
  margin: 0;
  padding-left: 18px;
  color: #374151;
  line-height: 1.8;
}

.warning-card {
  border-color: #f59e0b;
  background: #fffbeb;
}
</style>
