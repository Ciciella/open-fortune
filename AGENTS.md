# Repository Guidelines

## 项目结构与模块组织
本仓库采用前后端分离，核心包含两个包：
- `api/`：TypeScript 后端，包含交易逻辑、调度任务、交易所客户端与 HTTP 路由（`src/api`、`src/services`、`src/scheduler`、`src/database`、`src/strategies`）。
- `web/`：Vue 3 + Vite 前端（`src/pages`、`src/components`、`src/services`、`src/router`）。