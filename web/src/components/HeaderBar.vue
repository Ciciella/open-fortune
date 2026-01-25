<template>
  <el-card class="header-card" shadow="never">
    <el-row justify="space-between" align="middle">
      <el-col>
        <el-text tag="h1" size="large" class="logo">open-fortune</el-text>
      </el-col>
      <el-col>
        <el-space>
          <el-tag type="success" effect="dark">交易</el-tag>
          <el-link
            href="https://github.com/Ciciella/open-fortune"
            target="_blank"
            rel="noopener noreferrer"
            type="primary"
          >
            GitHub
          </el-link>
        </el-space>
      </el-col>
    </el-row>
  </el-card>
</template>

<script setup lang="ts">

</script>

<style scoped>
.header-card {
  border-radius: 12px;
}

.logo {
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style>
