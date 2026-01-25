# CLAUDE.md

此文件为在本仓库中工作的 Claude Code (claude.ai/code) 提供指导。

## 项目概述

**Open Fortune** 是一个包含 AI 驱动的加密货币自动交易系统的 monorepo，包含两个主要组件：

1. **API 后端** (`api/`) - 使用 VoltAgent 框架的 Node.js 交易引擎
2. **Web 前端** (`web/`) - Vue 3 监控仪表板

系统使用 AI 代理（通过 OpenAI 兼容 API 如 DeepSeek、OpenRouter）做出自主交易决策，通过 Gate.io 或 OKX 交易所执行交易。

## 架构

### 高层流程

```
交易代理 (AI) → VoltAgent 核心 → 交易所 API (Gate.io/OKX) → 数据库 (LibSQL)
         ↓
   Web 仪表板 (Vue 3)
```

### API 后端结构

```
api/
├── src/
│   ├── index.ts              # 主入口 - 启动交易循环、API 服务器、监控器
│   ├── agents/               # AI 代理定义
│   │   ├── tradingAgent.ts   # 主交易代理，包含提示词生成
│   │   ├── analysisAgents.ts # 多代理策略的子代理
│   │   └── aggressiveTeamAgents.ts # 激进团策略子代理
│   ├── strategies/           # 11 种交易策略
│   │   ├── index.ts          # 策略注册和提示词生成
│   │   ├── aiAutonomous.ts   # AI 完全自主（最小规则）
│   │   ├── aggressive.ts     # 高频、高杠杆
│   │   ├── balanced.ts       # 平衡风险/回报
│   │   ├── conservative.ts   # 低风险
│   │   ├── ultra-short.ts    # 超短线策略
│   │   ├── multiAgentConsensus.ts # 多 AI 代理投票
│   │   └── alphaBeta.ts      # Alpha/Beta 策略，含空仓时间规则
│   ├── scheduler/            # Cron 任务
│   │   ├── tradingLoop.ts    # 主交易循环（收集数据 → AI 决策 → 执行）
│   │   ├── accountRecorder.ts # 定期记录账户余额
│   │   ├── trailingStopMonitor.ts # 代码级移动止盈（10秒间隔）
│   │   ├── stopLossMonitor.ts # 代码级止损（10秒间隔）
│   │   └── partialProfitMonitor.ts # 代码级分批止盈（10秒间隔）
│   ├── services/             # 交易所集成
│   │   ├── exchangeClient.ts # 抽象客户端接口
│   │   ├── gateClient.ts     # Gate.io API 客户端
│   │   └── okxClient.ts      # OKX API 客户端
│   ├── tools/trading/        # 交易工具供 AI 代理使用
│   │   ├── marketData.ts     # getMarketPrice, getTechnicalIndicators
│   │   ├── tradeExecution.ts # openPosition, closePosition
│   │   └── accountManagement.ts # getAccountBalance, getPositions
│   ├── database/             # LibSQL (SQLite) 数据库
│   │   ├── schema.ts         # 数据库模式定义
│   │   ├── init.ts           # 数据库初始化
│   │   └── sync-*.ts         # 从交易所同步数据
│   └── api/routes.ts         # Hono HTTP API 供 Web 仪表板使用
```

### Web 前端结构

```
web/
├── src/
│   ├── pages/
│   │   └── MonitorPage.vue   # 主仪表板页面
│   ├── components/
│   │   ├── HeaderBar.vue     # 导航头部
│   │   ├── AccountPanel.vue  # 账户余额显示
│   │   ├── EquityChart.vue   # 资金曲线图表
│   │   ├── PositionsTable.vue # 当前持仓
│   │   ├── TradesTable.vue   # 交易历史
│   │   ├── DecisionPanel.vue # AI 决策日志
│   │   └── TickerBar.vue     # 实时价格滚动条
│   ├── services/
│   │   └── api.ts            # 后端 API 客户端
│   └── router/
│       └── index.ts          # Vue Router
```

### 交易循环流程 (api/src/scheduler/tradingLoop.ts)

1. **收集市场数据** - 获取价格、K线（1m、3m、5m、15m、30m、1h），计算指标（EMA、MACD、RSI、ATR）
2. **获取账户信息** - 余额、持仓、PnL、夏普比率
3. **风险检查** - 账户级止损止盈、极端止损、最大持仓时间
4. **AI 决策** - 生成包含所有数据的提示词 → AI 分析 → 返回带工具调用的决策
5. **执行交易** - AI 调用 openPosition/closePosition 工具
6. **同步与记录** - 更新数据库，记录决策日志

### 风险管理层级

1. **系统硬性限制**（代码级，自动执行）：
   - 极端止损：-30%（防止爆仓）
   - 最大持仓时间：36 小时（可配置）
   - 账户止损止盈：可配置的 USDT 阈值

2. **代码级保护**（策略可选，10秒间隔）：
   - 移动止盈：3 个级别（例如 4%→2%，8%→5%，12%→8%）
   - 止损：按杠杆分级（低/中/高）
   - 分批止盈：3 个阶段（例如 8%/12%/18%）

3. **AI 战术控制**：
   - AI 可在"双重保护"模式下覆盖代码级保护
   - AI 负责趋势分析、入场时机、仓位管理

## 常见开发任务

### 运行项目

**API 后端:**
```bash
cd api

# 开发模式（热重载）
npm run dev

# 生产模式
npm run trading:start

# 初始化数据库
npm run db:init

# 重置数据库
npm run db:reset
```

**Web 前端:**
```bash
cd web

# 开发模式
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 代码检查与类型检查

**API:**
```bash
cd api
npm run lint          # Biome 检查
npm run lint:fix      # 自动修复
npm run typecheck     # TypeScript 检查
```

**Web:**
```bash
cd web
npm run lint          # Biome 检查
npm run lint:fix      # 自动修复
```

### 数据库操作

```bash
cd api

# 初始化数据库模式
npm run db:init

# 检查数据一致性
npm run db:check-consistency

# 从交易所同步持仓
npm run db:sync-positions

# 从交易所同步所有数据
npm run db:sync
```

### PM2 进程管理（生产环境）

```bash
cd api

npm run pm2:start        # 启动生产环境
npm run pm2:start:dev    # 启动开发环境
npm run pm2:stop         # 停止
npm run pm2:restart      # 重启
npm run pm2:logs         # 查看日志
npm run pm2:list         # 列出进程
```

### Docker

```bash
cd api

npm run docker:build     # 构建镜像
npm run docker:up        # 启动容器
npm run docker:down      # 停止容器
npm run docker:logs      # 查看日志
```

### 运行脚本

```bash
cd api

# PnL 计算演示
npm run demo:calculate-pnl

# 测试 OKX WebSocket
npm run test:websocket

# 按币种分析交易
npm run analyze:trades -- --symbol=BTC
```

## 关键配置文件

### API (.env)
```env
# 交易配置
TRADING_STRATEGY=balanced          # 选项: balanced, aggressive, conservative, ai-autonomous, alpha-beta 等
TRADING_INTERVAL_MINUTES=20        # 交易循环间隔
MAX_LEVERAGE=25                    # 最大允许杠杆
MAX_POSITIONS=5                    # 最大并发持仓数
MAX_HOLDING_HOURS=36               # 自动平仓时间
EXTREME_STOP_LOSS_PERCENT=-30      # 硬性止损

# 数据库
DATABASE_URL=file:./.voltagent/trading.db

# 交易所
EXCHANGE=gate                      # gate 或 okx
GATE_API_KEY=your_key
GATE_API_SECRET=your_secret
GATE_USE_TESTNET=true              # 使用测试网确保安全

# AI 提供商
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL_NAME=deepseek/deepseek-v3.2-exp

# 风险管理
ACCOUNT_STOP_LOSS_USDT=50          # 账户级止损
ACCOUNT_TAKE_PROFIT_USDT=20000     # 账户级止盈
CLOSE_POSITION_PASSWORD=           # Web 手动平仓密码
```

### Web (Vite 配置)
- 端口: 5173 (开发)
- API 代理到后端（可在 vite.config.ts 中配置）

## 测试策略

项目没有传统的单元测试。替代方案：
- **手动测试** 通过测试网交易所
- **演示脚本** 在 `api/scripts/` 中用于验证
- **交易循环** 可在开发模式下运行以观察行为

## 重要说明

### 交易策略
- **ai-autonomous**: AI 完全控制，最小硬编码规则
- **alpha-beta**: 包含空仓时间规则（必须在 X 小时内交易）
- **multi-agent-consensus**: 使用 3 个子代理（技术、趋势、风险）投票
- **aggressive-team**: 使用 4 个子代理进行高频交易
- **balanced/conservative/aggressive**: 传统风险配置

### 代码级 vs AI 级保护
- 某些策略启用 `enableCodeLevelProtection` - 自动 10 秒监控
- `allowAiOverrideProtection` - AI 可覆盖代码级保护
- 检查 `api/src/strategies/types.ts` 了解策略配置

### 数据库模式
- `positions` - 当前开仓持仓（从交易所同步）
- `trades` - 交易历史（开平仓记录，含 PnL）
- `account_history` - 账户余额快照
- `agent_decisions` - AI 决策日志
- `trading_signals` - 技术指标快照
- `system_config` - 运行时配置

### API 端点（后端）
- `GET /api/account` - 账户余额 & PnL
- `GET /api/positions` - 当前持仓（实时从交易所获取）
- `GET /api/trades` - 交易历史
- `GET /api/logs` - AI 决策日志
- `GET /api/stats` - 交易统计（胜率、总 PnL）
- `GET /api/prices` - 实时价格
- `GET /api/strategy` - 当前策略配置
- `POST /api/close-position` - 手动平仓（需要密码）

### Web 仪表板
- 自动刷新数据：每 3 秒（持仓/账户）、10 秒（价格）、30 秒（交易/日志）
- 使用 Vue 3 Composition API + TypeScript
- 状态管理通过 refs/composables（无 Pinia）
- Chart.js 用于资金曲线图表

## 故障排查

### 常见问题

1. **交易循环未启动**
   - 检查 `.env` 文件是否存在且值正确
   - 先运行 `npm run db:init`
   - 检查 API 密钥是否有效

2. **Web 仪表板无法连接**
   - 后端默认端口: 3141
   - Web 默认端口: 5173
   - 检查后端 .env 中的 CORS_ORIGIN

3. **数据库锁定**
   - 关闭其他连接
   - 使用 `npm run db:close-and-reset` 重启

4. **交易所 API 错误**
   - 验证 API 密钥是否有期货交易权限
   - 检查 `GATE_USE_TESTNET=true` 用于测试
   - 确保账户在期货钱包中有资金

### 日志
- 后端日志: `npm run pm2:logs` 或查看控制台
- Web 日志: 浏览器 DevTools 控制台
- 交易决策: 记录到数据库表 `agent_decisions`

## 安全说明

- 切勿提交包含真实 API 密钥的 `.env` 文件
- 开发和测试时使用测试网
- `CLOSE_POSITION_PASSWORD` 保护手动平仓端点
- IP 黑名单中间件位于 `api/src/middleware/ipBlacklist.ts`

## 许可证

AGPL-3.0 - 网络使用需要公开源代码。
