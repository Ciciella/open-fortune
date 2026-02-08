/**
# open-fortune.ai - AI 加密货币自动交易系统易系统
 * Copyright (C) 2025 195440
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * 数据库模式定义
 */

export interface Trade {
  id: number;
  order_id: string;
  symbol: string;
  side: 'long' | 'short';
  type: 'open' | 'close';
  price: number;
  quantity: number;
  leverage: number;
  pnl?: number;
  fee?: number;
  timestamp: string;
  status: 'pending' | 'filled' | 'cancelled';
}

export interface Position {
  id: number;
  symbol: string;
  quantity: number;
  entry_price: number;
  current_price: number;
  liquidation_price: number;
  unrealized_pnl: number;
  leverage: number;
  side: 'long' | 'short';
  profit_target?: number;
  stop_loss?: number;
  tp_order_id?: string;
  sl_order_id?: string;
  entry_order_id: string;
  opened_at: string;
  confidence?: number;
  risk_usd?: number;
  peak_pnl_percent?: number; // 历史最高盈亏百分比（考虑杠杆）
  partial_close_percentage?: number; // 已通过分批止盈平掉的百分比 (0-100)
}

export interface AccountHistory {
  id: number;
  timestamp: string;
  total_value: number;
  available_cash: number;
  unrealized_pnl: number;
  realized_pnl: number;
  return_percent: number;
  sharpe_ratio?: number;
}

export interface TradingSignal {
  id: number;
  symbol: string;
  timestamp: string;
  price: number;
  ema_20: number;
  ema_50?: number;
  macd: number;
  rsi_7: number;
  rsi_14: number;
  volume: number;
  open_interest?: number;
  funding_rate?: number;
  atr_3?: number;
  atr_14?: number;
}

export interface AgentDecision {
  id: number;
  timestamp: string;
  iteration: number;
  market_analysis: string;
  decision: string;
  actions_taken: string;
  account_value: number;
  positions_count: number;
}

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  updated_at: string;
}

/**
 * SQL 建表语句
 */
export const CREATE_TABLES_SQL = `
-- 交易记录表
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  leverage INTEGER NOT NULL,
  pnl REAL,
  fee REAL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- 持仓表
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  current_price REAL NOT NULL,
  liquidation_price REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  leverage INTEGER NOT NULL,
  side TEXT NOT NULL,
  profit_target REAL,
  stop_loss REAL,
  tp_order_id TEXT,
  sl_order_id TEXT,
  entry_order_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  confidence REAL,
  risk_usd REAL,
  peak_pnl_percent REAL DEFAULT 0,
  partial_close_percentage REAL DEFAULT 0
);

-- 账户历史表
CREATE TABLE IF NOT EXISTS account_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  total_value REAL NOT NULL,
  available_cash REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  return_percent REAL NOT NULL,
  sharpe_ratio REAL
);

-- 技术指标表
CREATE TABLE IF NOT EXISTS trading_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  price REAL NOT NULL,
  ema_20 REAL NOT NULL,
  ema_50 REAL,
  macd REAL NOT NULL,
  rsi_7 REAL NOT NULL,
  rsi_14 REAL NOT NULL,
  volume REAL NOT NULL,
  open_interest REAL,
  funding_rate REAL,
  atr_3 REAL,
  atr_14 REAL
);

-- Agent 决策记录表
CREATE TABLE IF NOT EXISTS agent_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  market_analysis TEXT NOT NULL,
  decision TEXT NOT NULL,
  actions_taken TEXT NOT NULL,
  account_value REAL NOT NULL,
  positions_count INTEGER NOT NULL
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON trading_signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON trading_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON account_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON agent_decisions(timestamp);

-- Agent Teams 配置表
CREATE TABLE IF NOT EXISTS agent_teams_config (
  id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  interval_seconds INTEGER NOT NULL DEFAULT 30,
  max_budget_usdt REAL NOT NULL DEFAULT 200,
  max_team_positions INTEGER NOT NULL DEFAULT 3,
  updated_at TEXT NOT NULL
);

-- Agent Teams 团队注册表
CREATE TABLE IF NOT EXISTS agent_teams_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL UNIQUE,
  team_name TEXT NOT NULL,
  team_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Agent Teams 持仓表
CREATE TABLE IF NOT EXISTS agent_teams_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  leverage INTEGER NOT NULL,
  margin_used REAL NOT NULL,
  opened_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  UNIQUE(team_id, symbol)
);

-- Agent Teams 订单流水
CREATE TABLE IF NOT EXISTS agent_teams_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  action TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  status TEXT NOT NULL,
  exchange_raw TEXT,
  created_at TEXT NOT NULL
);

-- Agent Teams 决策链
CREATE TABLE IF NOT EXISTS agent_teams_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id TEXT NOT NULL UNIQUE,
  team_id TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  signal_summary TEXT NOT NULL,
  decision_text TEXT NOT NULL,
  risk_verdict TEXT NOT NULL,
  risk_reason TEXT NOT NULL,
  execution_result TEXT NOT NULL,
  confidence REAL NOT NULL,
  reward_risk_ratio REAL NOT NULL,
  tasks_summary TEXT,
  gate_trail TEXT,
  lead_conclusion TEXT,
  created_at TEXT NOT NULL
);

-- Agent Teams 调度周期
CREATE TABLE IF NOT EXISTS agent_teams_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  teams_count INTEGER NOT NULL,
  orders_count INTEGER NOT NULL,
  errors_count INTEGER NOT NULL,
  status TEXT NOT NULL
);

-- Agent Teams 风控拦截事件
CREATE TABLE IF NOT EXISTS agent_teams_risk_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  team_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  threshold TEXT NOT NULL,
  actual_value TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Agent Teams 任务面板
CREATE TABLE IF NOT EXISTS agent_teams_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL UNIQUE,
  cycle_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  specialist_type TEXT NOT NULL,
  objective TEXT NOT NULL,
  inputs TEXT NOT NULL,
  timeout_ms INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,
  result_summary TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Agent Teams 协作收件箱
CREATE TABLE IF NOT EXISTS agent_teams_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  cycle_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  specialist_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Agent Teams 门控轨迹
CREATE TABLE IF NOT EXISTS agent_teams_gate_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  gate_name TEXT NOT NULL,
  passed INTEGER NOT NULL,
  reason TEXT NOT NULL,
  meta TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Agent Teams 周期全链路快照
CREATE TABLE IF NOT EXISTS agent_teams_cycle_traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  status TEXT NOT NULL,
  lead_conclusion TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  inbox_json TEXT NOT NULL,
  gates_json TEXT NOT NULL,
  execution_json TEXT,
  UNIQUE(cycle_id, team_id)
);

-- Master Agent 配置
CREATE TABLE IF NOT EXISTS agent_master_config (
  id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  safety_mode TEXT NOT NULL DEFAULT 'risk_plus_simulation',
  allow_ephemeral_strategy INTEGER NOT NULL DEFAULT 1,
  legacy_system_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Master Agent 全局目标
CREATE TABLE IF NOT EXISTS agent_master_objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objective_id TEXT NOT NULL UNIQUE,
  objective_text TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Master Agent 决策记录
CREATE TABLE IF NOT EXISTS agent_master_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id TEXT NOT NULL UNIQUE,
  cycle_id TEXT NOT NULL,
  objective_id TEXT NOT NULL,
  selected_strategy_name TEXT NOT NULL,
  strategy_source TEXT NOT NULL,
  rationale_json TEXT NOT NULL,
  risk_verdict TEXT NOT NULL,
  execution_result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_teams_decisions_team_time
  ON agent_teams_decisions(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_teams_orders_team_time
  ON agent_teams_orders(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_teams_positions_team_symbol
  ON agent_teams_positions(team_id, symbol);
CREATE INDEX IF NOT EXISTS idx_agent_teams_cycles_time
  ON agent_teams_cycles(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_teams_tasks_team_cycle
  ON agent_teams_tasks(team_id, cycle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_teams_tasks_status
  ON agent_teams_tasks(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_teams_inbox_team_cycle
  ON agent_teams_inbox(team_id, cycle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_teams_gate_results_team_cycle
  ON agent_teams_gate_results(team_id, cycle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_teams_cycle_traces_cycle
  ON agent_teams_cycle_traces(cycle_id, team_id);
`;
