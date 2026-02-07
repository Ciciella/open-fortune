<template>
  <div class="header-bar">
    <div class="header-shell">
      <el-row justify="space-between" align="middle">
        <el-col :xs="24" :md="6">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true">
              <svg class="brand-icon" viewBox="0 0 24 24" role="img" aria-hidden="true">
                <rect x="5" y="8" width="14" height="10" rx="3" fill="#0f1114" stroke="#1f2a33" stroke-width="1.5" />
                <rect x="7.5" y="11" width="3" height="3" rx="1" fill="#17d6a6" />
                <rect x="13.5" y="11" width="3" height="3" rx="1" fill="#2f89ff" />
                <path d="M9 18h6" stroke="#1f2a33" stroke-width="1.5" stroke-linecap="round" />
                <path d="M12 5v2" stroke="#17d6a6" stroke-width="1.5" stroke-linecap="round" />
                <circle cx="12" cy="4" r="1.2" fill="#17d6a6" />
              </svg>
            </span>
            <el-text tag="h1" size="large" class="logo">open-fortune</el-text>
          </div>
        </el-col>
        <el-col :xs="24" :md="12" class="nav-col">
          <div class="nav-menu">
            <router-link class="nav-link-btn" to="/" exact-active-class="active">
              交易
            </router-link>
            <router-link
              class="nav-link-btn"
              to="/agent-teams"
              exact-active-class="active"
            >
              Agent Teams
            </router-link>
            <router-link
              class="nav-link-btn"
              to="/ai-chat"
              exact-active-class="active"
            >
              AI 对话
            </router-link>
            <router-link
              class="nav-link-btn"
              to="/config"
              exact-active-class="active"
            >
              配置
            </router-link>
          </div>
        </el-col>
        <el-col :xs="24" :md="6" class="header-actions">
          <a
            class="github-link"
            href="https://github.com/Ciciella/open-fortune"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">

</script>

<style scoped>
.header-bar {
  background: linear-gradient(180deg, #101214 0%, #090a0b 100%);
  border-bottom: 1px solid #1a1d21;
  color: #e8eaed;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 1000;
}

.header-shell {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 24px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: linear-gradient(135deg, #18e5b5 0%, #2f89ff 100%);
  box-shadow: 0 0 14px rgba(23, 214, 166, 0.7);
  padding: 3px;
}

.brand-icon {
  width: 18px;
  height: 18px;
}

.logo {
  font-weight: 600;
  letter-spacing: 0.6px;
  font-size: 1rem;
  margin: 0;
  color: #f5f7fa;
}

.nav-col {
  display: flex;
  justify-content: center;
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 18px;
  justify-content: flex-start;
}

.nav-link-btn {
  font-size: 0.95rem;
  letter-spacing: 0.4px;
  font-weight: 600;
  color: #c8cdd3;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 999px;
  position: relative;
  transition: color 0.2s ease;
}

.nav-link-btn:hover {
  color: #ffffff;
}

.nav-link-btn.active {
  color: #ffffff;
}

.nav-link-btn.active::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -2px;
  width: 28px;
  height: 2px;
  transform: translateX(-50%);
  background: #17d6a6;
  box-shadow: 0 0 8px rgba(23, 214, 166, 0.6);
  border-radius: 999px;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.github-link {
  padding: 6px 16px;
  border-radius: 999px;
  background: #0f1114;
  border: 1px solid #2a2f36;
  color: #e8eaed;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  cursor: pointer;
}

.github-link:hover,
.github-link:focus,
.github-link:active {
  background: #0f1114;
  border: 1px solid #2a2f36;
  color: #e8eaed;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
  text-decoration: none;
  outline: none;
}

@media (max-width: 768px) {
  .header-shell {
    padding: 10px 12px;
  }

  .nav-menu {
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-top: 8px;
    gap: 12px;
  }

  .header-actions {
    justify-content: flex-start;
    margin-top: 8px;
  }
}
</style>
