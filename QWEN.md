# Open Fortune 项目上下文

## 项目概述

Open Fortune 是一个前后端分离的金融交易/投资相关产品原型与管理界面，包含后端 API 服务与 Web 前端界面两个主要部分。该项目定位为 AI 驱动的加密货币自动交易系统，名为 open-fortune.ai，将大语言模型智能与量化交易实践深度融合。

### 后端 (API)

- **技术栈**: TypeScript, Node.js 20+, Hono (Web 框架), LibSQL (SQLite), VoltAgent (AI Agent 框架)
- **AI 集成**: 支持 OpenAI 兼容 API，包括 DeepSeek V3.2, Grok4, Claude 4.5, Gemini Pro 2.5 等模型
- **交易所集成**: Gate.io 和 OKX，支持测试网和正式网
- **核心功能**:
  - AI 驱动的交易决策
  - 实时市场数据分析
  - 仓位管理和风险控制
  - 移动止盈、止损监控
  - 分批止盈策略
  - 交易历史记录和审计
  - Web 仪表板监控

### 前端 (Web)

- **技术栈**: Vue 3, TypeScript, Vite, Pinia (状态管理), Element Plus (UI 组件库), Chart.js (图表)
- **核心功能**:
  - 交易系统监控仪表板
  - 实时账户指标显示
  - AI 决策日志展示
  - 交易历史查看
  - 仓位管理界面

## 项目架构

```
open-fortune/
├── api/                 # 后端服务 (AI 加密货币自动交易系统)
│   ├── src/
│   │   ├── agents/      # AI 代理逻辑
│   │   ├── api/         # API 路由
│   │   ├── config/      # 配置文件
│   │   ├── database/    # 数据库相关
│   │   ├── middleware/  # 中间件
│   │   ├── scheduler/   # 定时任务调度器
│   │   ├── services/    # 业务服务
│   │   ├── strategies/  # 交易策略
│   │   ├── tools/       # 工具类
│   │   ├── types/       # 类型定义
│   │   └── utils/       # 工具函数
│   ├── package.json
│   └── ...
├── web/                 # 前端应用 (Vue 3 应用)
│   ├── src/
│   │   ├── components/  # Vue 组件
│   │   ├── views/       # 页面视图
│   │   ├── stores/      # Pinia 状态管理
│   │   ├── router/      # 路由配置
│   │   └── utils/       # 工具函数
│   ├── package.json
│   └── ...
├── package.json         # 根目录包配置
└── README.md
```

## 构建和运行

### 环境要求

- Node.js >= 20.19.0
- npm 或 pnpm 包管理器

### 后端 (API) 启动

1. **安装依赖**:
   ```bash
   cd api
   npm install
   ```

2. **配置环境变量**:
   在 `api/` 目录下创建 `.env` 文件，配置必要的 API 密钥和参数

3. **初始化数据库**:
   ```bash
   npm run db:init
   ```

4. **启动开发模式**:
   ```bash
   npm run dev
   ```

5. **生产模式启动**:
   ```bash
   npm run trading:start
   ```

### 前端 (Web) 启动

1. **安装依赖**:
   ```bash
   cd web
   npm install
   ```

2. **启动开发服务器**:
   ```bash
   npm run dev
   ```

3. **构建生产版本**:
   ```bash
   npm run build
   ```

### 根目录命令

- `npm run lint`: 检查整个项目的代码质量
- `npm run lint:fix`: 修复整个项目的代码格式问题

## 开发约定

### 代码风格

- 使用 Biome 作为代码格式化和 Lint 工具
- 遵循 TypeScript 最佳实践
- 使用 ESLint 规则进行代码质量检查

### 风险管理

- 项目内置多重风险控制机制（移动止盈、止损、分批止盈）
- 支持账户级别的止损和止盈设置
- 提供双重防护模式（代码级自动 + AI 主动）

### 交易所集成

- 支持 Gate.io 和 OKX 交易所
- 提供测试网和正式网切换选项
- 支持多种加密货币（BTC, ETH, SOL, BNB, XRP, DOGE 等）

## 项目特点

1. **AI 驱动**: 采用最小人工干预设计理念，让 AI 模型基于原始市场数据进行自主学习和决策
2. **实时监控**: 提供 Web 仪表板实时监控账户指标和持仓情况
3. **风险管理**: 内置多层风险控制机制，保护用户资金安全
4. **灵活配置**: 支持多种交易策略和参数配置
5. **开源协议**: 采用 AGPL-3.0 开源协议

## 注意事项

- 该项目仅供教育和研究目的
- 加密货币交易具有重大风险，可能导致资金损失
- 建议首次使用时在测试网环境中测试策略
- 仅投资您能承受损失的资金
- 用户对所有交易活动承担全部责任