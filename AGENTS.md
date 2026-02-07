# Repository Guidelines

## 项目结构与模块组织
本仓库采用前后端分离，核心包含两个包：
- `api/`：TypeScript 后端，包含交易逻辑、调度任务、交易所客户端与 HTTP 路由（`src/api`、`src/services`、`src/scheduler`、`src/database`、`src/strategies`）。
- `web/`：Vue 3 + Vite 前端（`src/pages`、`src/components`、`src/services`、`src/router`）。

其他目录：
- `docs/`：项目文档与图片资源。
- `log-exports/`：导出的日志与分析产物。

## 构建、测试与开发命令
默认在仓库根目录执行：
- `npm --prefix api run dev`：启动后端开发模式（读取 `.env`）。
- `npm --prefix web run dev`：启动前端开发服务器。
- `npm --prefix api run build`：构建后端到 `api/dist/`。
- `npm --prefix web run build`：前端类型检查并打包。
- `npm run lint`：全仓库执行 Biome 检查。
- `npm run lint:fix`：自动修复可修复的格式/规范问题。
- `npm --prefix api run typecheck`：后端 TypeScript 类型检查。

## 代码风格与命名约定
- 语言：前后端统一使用 TypeScript，前端页面使用 Vue SFC。
- 规范工具：Biome（`biome.json`、`web/biome.json`），提交前建议先运行 lint。
- 格式：遵循 Biome 默认风格（2 空格缩进、双引号）。
- 命名：变量/函数使用 `camelCase`，组件与类型使用 `PascalCase`，脚本文件使用 `kebab-case`。

## 测试指南
当前暂无完整单元测试体系，优先执行针对性验证脚本：
- `npm --prefix api run test:websocket`
- `npm --prefix api run db:check-consistency`
- `npm --prefix api run analyze:trades`

前端改动请在 `web` 开发环境手工验证；涉及界面或交互变更时，PR 附截图。

## 提交与合并请求规范
从现有历史看，提交信息以简短祈使句为主，且中英混用。建议统一为：
- `<type>: <简要说明>`（例如：`fix: 修正风险阈值同步逻辑`）
- 常用类型：`feat`、`fix`、`refactor`、`docs`、`chore`。

PR 建议包含：
- 变更范围与动机。
- 关联 Issue（如有）。
- 验证步骤（执行过的命令）。
- 前端可见改动的截图。

## 安全与配置提示
- 敏感信息仅放在 `api/.env`，禁止提交 API 密钥。
- 开发阶段默认使用交易所测试网。
- 启用实盘前先复核 `api/src/config/riskParams.ts` 中的风控参数。
