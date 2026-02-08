/**
 * open-fortune.ai - AI 加密货币自动交易系统
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
 * API 路由
 */
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createClient } from "@libsql/client";
import { createExchangeClient } from "../services/exchangeClient";
import { createLogger } from "../utils/loggerUtils";
import { getTradingStrategy, getStrategyParams } from "../agents/tradingAgent";
import { RISK_PARAMS } from "../config/riskParams";
import { getChinaTimeISO } from "../utils/timeUtils";
import { getQuantoMultiplier } from "../utils/contractUtils";
import { ipBlacklistMiddleware } from "../middleware/ipBlacklist";
import { agentTeamsService } from "../agentTeams/service";
import { agentTeamsOrchestrator } from "../agentTeams/orchestrator";
import { applyLegacySystemSetting } from "../scheduler/legacySystemControl";

const logger = createLogger({
  name: "api-routes",
  level: "info",
});

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});
let tradesOpenSourceColumnEnsured = false;
let tradesOpenTimestampColumnEnsured = false;

async function ensureTradesOpenSourceColumn() {
  if (tradesOpenSourceColumnEnsured) {
    return;
  }
  try {
    await dbClient.execute(
      "ALTER TABLE trades ADD COLUMN open_source TEXT",
    );
  } catch {
    // ignore existing column errors
  } finally {
    tradesOpenSourceColumnEnsured = true;
  }
}

async function ensureTradesOpenTimestampColumn() {
  if (tradesOpenTimestampColumnEnsured) {
    return;
  }
  try {
    await dbClient.execute(
      "ALTER TABLE trades ADD COLUMN open_timestamp TEXT",
    );
  } catch {
    // ignore existing column errors
  } finally {
    tradesOpenTimestampColumnEnsured = true;
  }
}

export function createApiRoutes() {
  const app = new Hono();
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

  app.use("*", async (c, next) => {
    c.header("Access-Control-Allow-Origin", corsOrigin);
    c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  });

  // IP 黑名单中间件 - 拦截黑名单 IP
  app.use("*", ipBlacklistMiddleware);

  // 静态文件服务 - 需要使用绝对路径
  app.use("/*", serveStatic({ root: "./public" }));

  /**
   * 获取账户总览
   * 
   * Gate.io 账户结构：
   * - account.total = available + positionMargin
   * - account.total 不包含未实现盈亏
   * - 真实总资产 = account.total + unrealisedPnl
   * 
   * API返回说明：
   * - totalBalance: 不包含未实现盈亏的总资产（用于计算已实现收益）
   * - unrealisedPnl: 当前持仓的未实现盈亏
   * 
   * 前端显示：
   * - 总资产显示 = totalBalance + unrealisedPnl（实时反映持仓盈亏）
   */
  app.get("/api/account", async (c) => {
    try {
      const exchangeClient = createExchangeClient();
      const account = await exchangeClient.getFuturesAccount();
      
      // 从数据库获取初始资金
      const initialResult = await dbClient.execute(
        "SELECT total_value FROM account_history ORDER BY timestamp ASC LIMIT 1"
      );
      const initialBalance = initialResult.rows[0]
        ? Number.parseFloat(initialResult.rows[0].total_value as string)
        : 100;
      
      // Gate.io 的 account.total 不包含未实现盈亏
      // 总资产（不含未实现盈亏）= account.total
      const unrealisedPnl = Number.parseFloat(account.unrealisedPnl || "0");
      const totalBalance = Number.parseFloat(account.total || "0");
      
      // 收益率 = (总资产 - 初始资金) / 初始资金 * 100
      // 总资产不包含未实现盈亏，收益率反映已实现盈亏
      const returnPercent = ((totalBalance - initialBalance) / initialBalance) * 100;
      
      return c.json({
        totalBalance,  // 总资产（不包含未实现盈亏）
        availableBalance: Number.parseFloat(account.available || "0"),
        positionMargin: Number.parseFloat(account.positionMargin || "0"),
        unrealisedPnl,
        returnPercent,  // 收益率（不包含未实现盈亏）
        initialBalance,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取当前持仓 - 从 Gate.io 获取实时数据
   */
  app.get("/api/positions", async (c) => {
    try {
      const exchangeClient = createExchangeClient();
      const gatePositions = await exchangeClient.getPositions();
      
      // 从数据库获取止损止盈信息（AI交易）
      const dbResult = await dbClient.execute("SELECT symbol, stop_loss, profit_target FROM positions");
      const dbPositionsMap = new Map(
        dbResult.rows.map((row: any) => [row.symbol, row])
      );
      // Agent Teams 持仓来源
      const agentTeamsResult = await dbClient.execute(
        "SELECT symbol FROM agent_teams_positions WHERE status = 'open'"
      );
      const agentTeamsSymbolSet = new Set(
        agentTeamsResult.rows.map((row: any) => String(row.symbol))
      );
      // 来源兜底：当实时持仓未被两个持仓表直接命中时，按最近开仓记录判断来源
      const [agentTeamsOpenOrdersResult, aiOpenTradesResult, agentTeamsDecisionsResult] =
        await Promise.all([
        dbClient.execute(
          `SELECT symbol, MAX(created_at) AS last_open_at
           FROM agent_teams_orders
           WHERE action = 'open'
           GROUP BY symbol`
        ),
        dbClient.execute(
          `SELECT symbol, MAX(timestamp) AS last_open_at
           FROM trades
           WHERE type = 'open'
          GROUP BY symbol`
        ),
        dbClient.execute(
          `SELECT signal_summary, decision_text, created_at
           FROM agent_teams_decisions
           ORDER BY created_at DESC
           LIMIT 300`
        ),
      ]);
      const agentTeamsOpenMap = new Map<string, string>(
        agentTeamsOpenOrdersResult.rows.map((row: any) => [
          String(row.symbol).replace(/_USDT$/i, "").toUpperCase(),
          String(row.last_open_at || ""),
        ]),
      );
      const aiOpenMap = new Map<string, string>(
        aiOpenTradesResult.rows.map((row: any) => [
          String(row.symbol).replace(/_USDT$/i, "").toUpperCase(),
          String(row.last_open_at || ""),
        ]),
      );
      const agentTeamsDecisionMap = new Map<string, string>();
      for (const row of agentTeamsOpenOrdersResult.rows) {
        const symbol = String((row as any).symbol || "")
          .replace(/_USDT$/i, "")
          .toUpperCase();
        const createdAt = String((row as any).last_open_at || "");
        if (symbol) {
          agentTeamsDecisionMap.set(symbol, createdAt);
        }
      }
      const toTs = (value?: string) => {
        if (!value) return Number.NEGATIVE_INFINITY;
        const normalized = value.replace(" ", "T");
        const ts = Date.parse(normalized);
        return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
      };
      for (const row of agentTeamsDecisionsResult.rows) {
        const signalSummary = String((row as any).signal_summary || "");
        const decisionText = String((row as any).decision_text || "");
        const createdAt = String((row as any).created_at || "");
        const matched = (signalSummary.match(/\b[A-Z]{2,10}\b/) ||
          decisionText.match(/\b[A-Z]{2,10}\b/))?.[0];
        if (!matched) {
          continue;
        }
        const normalizedSymbol = matched.replace(/_USDT$/i, "").toUpperCase();
        if (!agentTeamsDecisionMap.has(normalizedSymbol)) {
          agentTeamsDecisionMap.set(normalizedSymbol, createdAt);
        }
      }
      
      // 过滤并格式化持仓
      const positions = gatePositions
        .filter((p: any) => Number.parseInt(p.size || "0") !== 0)
        .map((p: any) => {
          const size = Number.parseInt(p.size || "0");
          const symbol = String(p.contract || "")
            .replace(/_USDT$/i, "")
            .toUpperCase();
          const dbPos = dbPositionsMap.get(symbol);
          const entryPrice = Number.parseFloat(p.entryPrice || "0");
          const quantity = Math.abs(size);
          const leverage = Number.parseInt(p.leverage || "1");
          const inLegacy = dbPositionsMap.has(symbol);
          const inAgentTeams = agentTeamsSymbolSet.has(symbol);
          let openSource: "AI交易" | "Agent Teams" | "未知来源" | "来源冲突" =
            inLegacy && inAgentTeams
              ? "来源冲突"
              : inAgentTeams
                ? "Agent Teams"
                : inLegacy
                  ? "AI交易"
                  : "未知来源";

          if (openSource === "未知来源") {
            const agentTeamsLastOpen = agentTeamsOpenMap.get(symbol);
            const aiLastOpen = aiOpenMap.get(symbol);
            const agentTeamsTs = toTs(agentTeamsLastOpen);
            const aiTs = toTs(aiLastOpen);
            if (Number.isFinite(agentTeamsTs) || Number.isFinite(aiTs)) {
              if (!Number.isFinite(aiTs) || agentTeamsTs >= aiTs) {
                openSource = "Agent Teams";
              } else {
                openSource = "AI交易";
              }
            } else if (agentTeamsDecisionMap.has(symbol)) {
              openSource = "Agent Teams";
            }
          }
          
          // 开仓价值（保证金）: 从Gate.io API直接获取
          const openValue = Number.parseFloat(p.margin || "0");
          
          return {
            symbol,
            quantity,
            entryPrice,
            currentPrice: Number.parseFloat(p.markPrice || "0"),
            liquidationPrice: Number.parseFloat(p.liqPrice || "0"),
            unrealizedPnl: Number.parseFloat(p.unrealisedPnl || "0"),
            leverage,
            side: size > 0 ? "long" : "short",
            openSource,
            openValue,
            profitTarget: dbPos?.profit_target ? Number(dbPos.profit_target) : null,
            stopLoss: dbPos?.stop_loss ? Number(dbPos.stop_loss) : null,
            openedAt: p.create_time || new Date().toISOString(),
          };
        });
      
      return c.json({ positions });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取账户价值历史（用于绘图）
   */
  app.get("/api/history", async (c) => {
    try {
      const limitParam = c.req.query("limit");
      
      let result;
      if (limitParam) {
        // 如果传递了 limit 参数，使用 LIMIT 子句
        const limit = Number.parseInt(limitParam);
        result = await dbClient.execute({
          sql: `SELECT timestamp, total_value, unrealized_pnl, return_percent 
                FROM account_history 
                ORDER BY timestamp DESC 
                LIMIT ?`,
          args: [limit],
        });
      } else {
        // 如果没有传递 limit 参数，返回全部数据
        result = await dbClient.execute(
          `SELECT timestamp, total_value, unrealized_pnl, return_percent 
           FROM account_history 
           ORDER BY timestamp DESC`
        );
      }
      
      const history = result.rows.map((row: any) => ({
        timestamp: row.timestamp,
        totalValue: Number.parseFloat(row.total_value as string) || 0,
        unrealizedPnl: Number.parseFloat(row.unrealized_pnl as string) || 0,
        returnPercent: Number.parseFloat(row.return_percent as string) || 0,
      })).reverse(); // 反转，使时间从旧到新
      
      return c.json({ history });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取交易记录 - 从数据库获取历史仓位（已平仓的记录）
   */
  app.get("/api/trades", async (c) => {
    try {
      const limit = Number.parseInt(c.req.query("limit") || "10");
      const symbol = c.req.query("symbol"); // 可选，筛选特定币种
      
      // 从数据库获取历史交易记录（按 ID 降序，确保最新的在前）
      let sql = `SELECT * FROM trades ORDER BY id DESC LIMIT ?`;
      let args: any[] = [limit];
      
      if (symbol) {
        sql = `SELECT * FROM trades WHERE symbol = ? ORDER BY id DESC LIMIT ?`;
        args = [symbol, limit];
      }
      
      logger.info(`查询交易记录: limit=${limit}, symbol=${symbol || 'all'}`);
      
      const result = await dbClient.execute({
        sql,
        args,
      });
      
      logger.info(`查询到 ${result.rows.length} 条交易记录`);
      
      if (!result.rows || result.rows.length === 0) {
        return c.json({ trades: [] });
      }
      
      const toTs = (value?: string | null) => {
        if (!value) return Number.NaN;
        const normalized = value.replace(" ", "T");
        const ts = Date.parse(normalized);
        return Number.isFinite(ts) ? ts : Number.NaN;
      };
      const buildKey = (symbol: string, side: string) => `${symbol}::${side}`;
      type OpenSource = "AI交易" | "Agent Teams" | "未知来源" | "来源冲突";
      const getSourceFromSet = (sources: Set<OpenSource>): OpenSource => {
        if (sources.size === 0) return "未知来源";
        if (sources.size === 1) return Array.from(sources)[0] ?? "未知来源";
        return "来源冲突";
      };

      const allAgentOpenOrderIds = new Set<string>();
      const allAgentOpenOrderIdsResult = await dbClient.execute({
        sql: `SELECT order_id
              FROM agent_teams_orders
              WHERE action = 'open'
                AND quantity > 0
                AND status NOT IN ('rejected', 'failed', 'cancelled')`,
        args: [],
      });
      for (const row of allAgentOpenOrderIdsResult.rows) {
        const orderId = String((row as any).order_id || "");
        if (orderId) {
          allAgentOpenOrderIds.add(orderId);
        }
      }

      type OpenLot = { timestamp: string; quantity: number; source: OpenSource };
      const openLotsMap = new Map<string, OpenLot[]>();
      const closeRows = result.rows.filter((row: any) => row.type === "close");
      const uniqueKeys = Array.from(
        new Set(closeRows.map((row: any) => buildKey(String(row.symbol), String(row.side)))),
      );

      await Promise.all(
        uniqueKeys.map(async (key) => {
          const [symbol, side] = key.split("::");
          const [legacyOpenResult, agentOpenResult] = await Promise.all([
            dbClient.execute({
              sql: `SELECT timestamp, quantity, order_id
                    FROM trades
                    WHERE symbol = ? AND side = ? AND type = 'open'
                    ORDER BY timestamp ASC`,
              args: [symbol, side],
            }),
            dbClient.execute({
              sql: `SELECT created_at AS timestamp, quantity, order_id
                    FROM agent_teams_orders
                    WHERE symbol = ? AND side = ? AND action = 'open'
                      AND quantity > 0
                      AND status NOT IN ('rejected', 'failed', 'cancelled')
                    ORDER BY created_at ASC`,
              args: [symbol, side],
            }),
          ]);

          const lots: OpenLot[] = [
            ...legacyOpenResult.rows.map((row: any) => ({
              timestamp: String(row.timestamp),
              quantity: Number(row.quantity || 0),
              source: allAgentOpenOrderIds.has(String(row.order_id || ""))
                ? ("Agent Teams" as const)
                : ("AI交易" as const),
            })),
            ...agentOpenResult.rows.map((row: any) => ({
              timestamp: String(row.timestamp),
              quantity: Number(row.quantity || 0),
              source: "Agent Teams" as const,
            })),
          ]
            .filter((lot) => lot.quantity > 0 && Number.isFinite(toTs(lot.timestamp)))
            .sort((a, b) => toTs(a.timestamp) - toTs(b.timestamp));

          openLotsMap.set(key, lots);
        }),
      );

      const matchedOpenTimestampById = new Map<number, string | null>();
      const matchedOpenSourceById = new Map<number, OpenSource>();
      const sortedCloseRows = [...closeRows].sort(
        (a: any, b: any) => toTs(String(a.timestamp)) - toTs(String(b.timestamp)),
      );
      for (const closeRow of sortedCloseRows) {
        const key = buildKey(String(closeRow.symbol), String(closeRow.side));
        const lots = openLotsMap.get(key) ?? [];
        let remaining = Number(closeRow.quantity || 0);
        let matchedOpenTimestamp: string | null = null;
        const matchedSources = new Set<OpenSource>();

        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          if (lot.quantity <= 0) {
            lots.shift();
            continue;
          }
          if (!matchedOpenTimestamp) {
            matchedOpenTimestamp = lot.timestamp;
          }
          matchedSources.add(lot.source);
          const consumed = Math.min(remaining, lot.quantity);
          remaining -= consumed;
          lot.quantity -= consumed;
          if (lot.quantity <= 0) {
            lots.shift();
          }
        }

        // 数量无法配对时，不展示开仓时间，避免误导
        matchedOpenTimestampById.set(
          Number(closeRow.id),
          remaining > 0 ? null : matchedOpenTimestamp,
        );
        matchedOpenSourceById.set(
          Number(closeRow.id),
          remaining > 0 ? "未知来源" : getSourceFromSet(matchedSources),
        );
      }

      // 转换数据库格式到前端需要的格式
      const trades = result.rows.map((row: any) => {
        const type = row.type as "open" | "close";
        const closeTimestamp = type === "close" ? String(row.timestamp) : null;
        const explicitOpenTimestamp = String((row as any).open_timestamp || "");
        const openTimestamp =
          type === "open"
            ? String(row.timestamp)
            : explicitOpenTimestamp ||
                (matchedOpenTimestampById.get(Number(row.id)) ?? null);
        const explicitOpenSource = String((row as any).open_source || "");
        const openSource: OpenSource =
          explicitOpenSource === "AI交易" ||
          explicitOpenSource === "Agent Teams" ||
          explicitOpenSource === "未知来源" ||
          explicitOpenSource === "来源冲突"
            ? (explicitOpenSource as OpenSource)
            : type === "open"
              ? allAgentOpenOrderIds.has(String(row.order_id || ""))
                ? "Agent Teams"
                : "AI交易"
              : matchedOpenSourceById.get(Number(row.id)) ?? "未知来源";
        let holdingDurationSec: number | null = null;
        if (type === "close" && openTimestamp && closeTimestamp) {
          const openTs = toTs(openTimestamp);
          const closeTs = toTs(closeTimestamp);
          if (Number.isFinite(openTs) && Number.isFinite(closeTs) && closeTs >= openTs) {
            holdingDurationSec = Math.floor((closeTs - openTs) / 1000);
          }
        }

        return {
          id: row.id,
          orderId: row.order_id,
          symbol: row.symbol,
          side: row.side, // long/short
          type, // open/close
          price: Number.parseFloat(row.price || "0"),
          quantity: Number.parseFloat(row.quantity || "0"),
          leverage: Number.parseInt(row.leverage || "1"),
          pnl: row.pnl ? Number.parseFloat(row.pnl) : null,
          fee: Number.parseFloat(row.fee || "0"),
          timestamp: row.timestamp,
          openTimestamp,
          openSource,
          closeTimestamp,
          holdingDurationSec,
          status: row.status,
        };
      });

      return c.json({ trades });
    } catch (error: any) {
      logger.error("获取历史仓位失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取 Agent 决策日志
   */
  app.get("/api/logs", async (c) => {
    try {
      const limit = c.req.query("limit") || "20";
      
      const result = await dbClient.execute({
        sql: `SELECT * FROM agent_decisions 
              ORDER BY timestamp DESC 
              LIMIT ?`,
        args: [Number.parseInt(limit)],
      });
      
      const logs = result.rows.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        iteration: row.iteration,
        decision: row.decision,
        actionsTaken: row.actions_taken,
        accountValue: row.account_value,
        positionsCount: row.positions_count,
      }));
      
      return c.json({ logs });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取交易统计
   */
  app.get("/api/stats", async (c) => {
    try {
      // 统计总交易次数 - 使用 pnl IS NOT NULL 来确保这是已完成的平仓交易
      const totalTradesResult = await dbClient.execute(
        "SELECT COUNT(*) as count FROM trades WHERE type = 'close' AND pnl IS NOT NULL"
      );
      const totalTrades = (totalTradesResult.rows[0] as any).count;
      
      // 统计盈利交易
      const winTradesResult = await dbClient.execute(
        "SELECT COUNT(*) as count FROM trades WHERE type = 'close' AND pnl IS NOT NULL AND pnl > 0"
      );
      const winTrades = (winTradesResult.rows[0] as any).count;
      
      // 计算胜率
      const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
      
      // 计算总盈亏
      const pnlResult = await dbClient.execute(
        "SELECT SUM(pnl) as total_pnl FROM trades WHERE type = 'close' AND pnl IS NOT NULL"
      );
      const totalPnl = (pnlResult.rows[0] as any).total_pnl || 0;
      
      // 获取最大单笔盈利和亏损
      const maxWinResult = await dbClient.execute(
        "SELECT MAX(pnl) as max_win FROM trades WHERE type = 'close' AND pnl IS NOT NULL"
      );
      const maxWin = (maxWinResult.rows[0] as any).max_win || 0;
      
      const maxLossResult = await dbClient.execute(
        "SELECT MIN(pnl) as max_loss FROM trades WHERE type = 'close' AND pnl IS NOT NULL"
      );
      const maxLoss = (maxLossResult.rows[0] as any).max_loss || 0;
      
      return c.json({
        totalTrades,
        winTrades,
        lossTrades: totalTrades - winTrades,
        winRate,
        totalPnl,
        maxWin,
        maxLoss,
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取多个币种的实时价格
   */
  app.get("/api/prices", async (c) => {
    try {
      const symbolsParam = c.req.query("symbols") || "BTC,ETH,SOL,BNB,DOGE,XRP";
      const symbols = symbolsParam.split(",").map(s => s.trim());
      
      const exchangeClient = createExchangeClient();
      const prices: Record<string, number> = {};
      
      // 并发获取所有币种价格
      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const contract = `${symbol}_USDT`;
            const ticker = await exchangeClient.getFuturesTicker(contract);
            prices[symbol] = Number.parseFloat(ticker.last || "0");
          } catch (error: any) {
            logger.error(`获取 ${symbol} 价格失败:`, error);
            prices[symbol] = 0;
          }
        })
      );
      
      return c.json({ prices });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 获取当前交易策略配置
   */
  app.get("/api/strategy", async (c) => {
    try {
      const strategy = getTradingStrategy();
      const params = getStrategyParams(strategy);
      const intervalMinutes = Number.parseInt(process.env.TRADING_INTERVAL_MINUTES || "20");
      
      // 策略名称映射
      const strategyNames: Record<string, string> = {
        "ultra-short": "超短线",
        "swing-trend": "波段趋势",
        "medium-long": "中长线",
        "conservative": "稳健",
        "balanced": "平衡",
        "aggressive": "激进",
        "aggressive-team": "激进团",
        "rebate-farming": "返佣套利",
        "ai-autonomous": "AI自主",
        "multi-agent-consensus": "陪审团策略"
      };
      
      return c.json({
        strategy,
        strategyName: strategyNames[strategy] || strategy,
        intervalMinutes,
        maxLeverage: RISK_PARAMS.MAX_LEVERAGE,
        maxPositions: RISK_PARAMS.MAX_POSITIONS,
        leverageRange: `${params.leverageMin}-${params.leverageMax}x`,
        positionSizeRange: `${params.positionSizeMin}-${params.positionSizeMax}%`,
        enableCodeLevelProtection: params.enableCodeLevelProtection,
        allowAiOverrideProtection: params.allowAiOverrideProtection || false,
        description: params.description
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * 手动平仓接口 - 需要验证密码
   */
  app.post("/api/close-position", async (c) => {
    try {
      // 获取请求体
      const body = await c.req.json();
      const { symbol, password, openSource } = body as {
        symbol?: string;
        password?: string;
        openSource?: string;
      };
      
      // 验证必填参数
      if (!symbol) {
        return c.json({ success: false, message: "缺少必填参数: symbol" }, 400);
      }
      
      // 验证密码 - 仅使用 CLOSE_POSITION_PASSWORD
      const correctPassword = process.env.CLOSE_POSITION_PASSWORD;
      
      // 如果未配置密码，拒绝平仓
      if (!correctPassword) {
        logger.error('平仓密码未配置 - 请在环境变量中设置 CLOSE_POSITION_PASSWORD');
        return c.json({ 
          success: false, 
          message: "平仓功能未启用" 
        }, 403);
      }
      
      if (!password || password !== correctPassword) {
        logger.warn(`平仓密码验证失败 - 币种: ${symbol}`);
        return c.json({ success: false, message: "密码错误" }, 403);
      }
      
      logger.info(`开始手动平仓: ${symbol}`);
      
      const exchangeClient = createExchangeClient();
      const contract = `${symbol}_USDT`;
      
      // 获取当前持仓
      const allPositions = await exchangeClient.getPositions();
      const gatePosition = allPositions.find((p: any) => 
        p.contract === contract && Number.parseInt(p.size || "0") !== 0
      );
      
      if (!gatePosition) {
        return c.json({ 
          success: false, 
          message: `没有找到 ${symbol} 的持仓` 
        }, 404);
      }
      
      // 获取持仓信息
      const size = Number.parseInt(gatePosition.size || "0");
      const side = size > 0 ? "long" : "short";
      const entryPrice = Number.parseFloat(gatePosition.entryPrice || "0");
      const currentPrice = Number.parseFloat(gatePosition.markPrice || "0");
      const leverage = Number.parseInt(gatePosition.leverage || "1");
      const quantity = Math.abs(size);
      
      // 获取合约乘数（不同币种的合约乘数不同）
      const quantoMultiplier = await getQuantoMultiplier(contract);
      logger.info(`${symbol} 合约乘数: ${quantoMultiplier}`);
      
      // 计算盈亏
      let grossPnl = 0;
      if (side === "long") {
        grossPnl = (currentPrice - entryPrice) * quantity * quantoMultiplier;
      } else {
        grossPnl = (entryPrice - currentPrice) * quantity * quantoMultiplier;
      }
      
      // 计算手续费
      const takerFee = 0.0005;
      const openFee = entryPrice * quantity * quantoMultiplier * takerFee;
      const closeFee = currentPrice * quantity * quantoMultiplier * takerFee;
      const totalFees = openFee + closeFee;
      const pnl = grossPnl - totalFees;
      
      logger.info(`手动平仓 ${symbol} ${side === "long" ? "做多" : "做空"} ${quantity}张 (入场: ${entryPrice.toFixed(2)}, 当前: ${currentPrice.toFixed(2)}, 盈亏: ${pnl.toFixed(2)})`);
      
      // 执行平仓
      const closeSize = side === "long" ? -quantity : quantity;
      const order = await exchangeClient.placeOrder({
        contract,
        size: closeSize,
        price: 0,  // 市价单
        reduceOnly: true,
      });
      
      logger.info(`已下达手动平仓订单 ${symbol}，订单ID: ${order.id}`);
      
      // 等待订单完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 获取实际成交信息
      let actualExitPrice = currentPrice;
      let orderStatus = "filled";
      
      if (order.id) {
        try {
          const orderInfo = await exchangeClient.getOrder(order.id);
          if (orderInfo.status === "finished") {
            actualExitPrice = Number.parseFloat(orderInfo.fillPrice || orderInfo.price || currentPrice.toString());
            orderStatus = "filled";
          }
        } catch (error: any) {
          logger.warn(`获取订单信息失败: ${error.message}`);
        }
      }
      
      // 重新计算实际盈亏（使用实际成交价格）
      if (side === "long") {
        grossPnl = (actualExitPrice - entryPrice) * quantity * quantoMultiplier;
      } else {
        grossPnl = (entryPrice - actualExitPrice) * quantity * quantoMultiplier;
      }
      const actualCloseFee = actualExitPrice * quantity * quantoMultiplier * takerFee;
      const actualPnl = grossPnl - openFee - actualCloseFee;
      
      const normalizedOpenSource =
        openSource === "AI交易" ||
        openSource === "Agent Teams" ||
        openSource === "未知来源" ||
        openSource === "来源冲突"
          ? openSource
          : "未知来源";

      await ensureTradesOpenSourceColumn();
      await ensureTradesOpenTimestampColumn();

      // 优先使用数据库记录的开仓时间；其次使用 Agent Teams 持仓记录；最后回退到交易所持仓创建时间
      const positionOpenedAtResult = await dbClient.execute({
        sql: "SELECT opened_at FROM positions WHERE symbol = ? LIMIT 1",
        args: [symbol],
      });
      const agentTeamsOpenedAtResult = await dbClient.execute({
        sql: `SELECT opened_at
              FROM agent_teams_positions
              WHERE symbol = ? AND status = 'open'
              ORDER BY opened_at DESC
              LIMIT 1`,
        args: [symbol],
      });
      const gateCreateTime = (gatePosition as any).create_time;
      const gateOpenedAt =
        typeof gateCreateTime === "number"
          ? new Date(gateCreateTime * 1000).toISOString()
          : typeof gateCreateTime === "string" && gateCreateTime
            ? gateCreateTime
            : null;
      const openTimestamp =
        String(positionOpenedAtResult.rows[0]?.opened_at || "") ||
        String(agentTeamsOpenedAtResult.rows[0]?.opened_at || "") ||
        gateOpenedAt ||
        null;

      // 记录到交易历史
      try {
        logger.info(`准备记录平仓交易到数据库: ${symbol}, 订单ID: ${order.id || `manual_${Date.now()}`}`);
        
        const insertResult = await dbClient.execute({
          sql: `INSERT INTO trades (order_id, symbol, side, type, price, quantity, leverage, pnl, fee, timestamp, status, open_source, open_timestamp)
                VALUES (?, ?, ?, 'close', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            order.id || `manual_${Date.now()}`,
            symbol,
            side,
            actualExitPrice,
            quantity,
            leverage,
            actualPnl,
            openFee + actualCloseFee,
            getChinaTimeISO(),
            orderStatus,
            normalizedOpenSource,
            openTimestamp,
          ],
        });
        
        logger.info(`✓ 交易历史记录成功，记录ID: ${insertResult.lastInsertRowid}`);
      } catch (dbError: any) {
        logger.error(`✗ 记录交易历史失败: ${dbError.message}`, dbError);
        throw dbError; // 抛出错误以便外层 catch 捕获
      }
      
      // 从数据库删除持仓记录
      try {
        const deleteResult = await dbClient.execute({
          sql: "DELETE FROM positions WHERE symbol = ?",
          args: [symbol],
        });
        logger.info(`✓ 已删除持仓记录: ${symbol}, 影响行数: ${deleteResult.rowsAffected}`);
      } catch (dbError: any) {
        logger.error(`✗ 删除持仓记录失败: ${dbError.message}`, dbError);
        // 这里不抛出错误，因为交易已经完成
      }
      
      logger.info(`手动平仓完成 ${symbol}, 盈亏: ${actualPnl.toFixed(2)} USDT`);
      
      return c.json({
        success: true,
        message: `成功平仓 ${symbol}`,
        data: {
          symbol,
          side,
          quantity,
          entryPrice,
          exitPrice: actualExitPrice,
          pnl: actualPnl,
          fee: openFee + actualCloseFee,
        },
      });
    } catch (error: any) {
      logger.error("手动平仓失败:", error);
      return c.json({ 
        success: false, 
        message: `平仓失败: ${error.message}` 
      }, 500);
    }
  });

  /**
   * Agent Teams 总览
   */
  app.get("/api/agent-teams/overview", async (c) => {
    try {
      const overview = await agentTeamsService.getOverview();
      return c.json(overview);
    } catch (error: any) {
      logger.error("获取 Agent Teams 总览失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Agent Teams 决策时间线
   */
  app.get("/api/agent-teams/decisions", async (c) => {
    try {
      const teamId = c.req.query("teamId");
      const limit = Number.parseInt(c.req.query("limit") || "20");
      const decisions = await agentTeamsService.getDecisions(teamId, limit);
      return c.json({ decisions });
    } catch (error: any) {
      logger.error("获取 Agent Teams 决策列表失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Agent Teams 周期链路详情
   */
  app.get("/api/agent-teams/cycle/:id", async (c) => {
    try {
      const cycleId = c.req.param("id");
      const traces = await agentTeamsService.getCycleTrace(cycleId);
      return c.json({ cycleId, traces });
    } catch (error: any) {
      logger.error("获取 Agent Teams 周期链路失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Agent Teams 任务列表
   */
  app.get("/api/agent-teams/tasks", async (c) => {
    try {
      const teamId = c.req.query("teamId");
      const cycleId = c.req.query("cycleId");
      const status = c.req.query("status") as
        | "pending"
        | "running"
        | "succeeded"
        | "failed"
        | "skipped"
        | undefined;
      const limit = Number.parseInt(c.req.query("limit") || "100");
      const tasks = await agentTeamsService.getTasks({
        teamId,
        cycleId,
        status,
        limit,
      });
      return c.json({ tasks });
    } catch (error: any) {
      logger.error("获取 Agent Teams 任务列表失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Agent Teams 决策详情
   */
  app.get("/api/agent-teams/decision/:id", async (c) => {
    try {
      const decisionId = c.req.param("id");
      const decision = await agentTeamsService.getDecisionById(decisionId);
      if (!decision) {
        return c.json({ error: "not found" }, 404);
      }
      return c.json(decision);
    } catch (error: any) {
      logger.error("获取 Agent Teams 决策详情失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Master Agent 目标配置
   */
  app.get("/api/agent-teams/master/objective", async (c) => {
    try {
      const objective = await agentTeamsService.getMasterObjective();
      return c.json(objective);
    } catch (error: any) {
      logger.error("获取 Master Objective 失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.put("/api/agent-teams/master/objective", async (c) => {
    try {
      const body = await c.req.json();
      if (typeof body.objectiveText !== "string" || !body.objectiveText.trim()) {
        return c.json({ error: "objectiveText is required" }, 400);
      }
      const objective = await agentTeamsService.setMasterObjective(body.objectiveText.trim());
      return c.json(objective);
    } catch (error: any) {
      logger.error("更新 Master Objective 失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Master Agent 运行配置
   */
  app.get("/api/agent-teams/master/config", async (c) => {
    try {
      const config = await agentTeamsService.getMasterConfig();
      return c.json(config);
    } catch (error: any) {
      logger.error("获取 Master Config 失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.patch("/api/agent-teams/master/config", async (c) => {
    try {
      const body = await c.req.json();
      const patch: Partial<{
        enabled: boolean;
        safetyMode: "risk_only" | "risk_plus_simulation" | "manual_confirm";
        allowEphemeralStrategy: boolean;
        legacySystemEnabled: boolean;
      }> = {};

      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (
        body.safetyMode === "risk_only" ||
        body.safetyMode === "risk_plus_simulation" ||
        body.safetyMode === "manual_confirm"
      ) {
        patch.safetyMode = body.safetyMode;
      }
      if (typeof body.allowEphemeralStrategy === "boolean") {
        patch.allowEphemeralStrategy = body.allowEphemeralStrategy;
      }
      if (typeof body.legacySystemEnabled === "boolean") {
        patch.legacySystemEnabled = body.legacySystemEnabled;
      }

      const config = await agentTeamsService.updateMasterConfig(patch);
      const teamsConfig = await agentTeamsService.getConfig();
      applyLegacySystemSetting({
        legacySystemEnabled: config.legacySystemEnabled,
        agentTeamsEnabled: teamsConfig?.enabled ?? false,
      });
      return c.json(config);
    } catch (error: any) {
      logger.error("更新 Master Config 失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Master Agent 决策日志
   */
  app.get("/api/agent-teams/master/decisions", async (c) => {
    try {
      const limit = Number.parseInt(c.req.query("limit") || "20");
      const decisions = await agentTeamsService.getMasterDecisions(limit);
      return c.json({ decisions });
    } catch (error: any) {
      logger.error("获取 Master 决策列表失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get("/api/agent-teams/master/decision/:id", async (c) => {
    try {
      const decisionId = c.req.param("id");
      const decision = await agentTeamsService.getMasterDecisionById(decisionId);
      if (!decision) {
        return c.json({ error: "not found" }, 404);
      }
      return c.json(decision);
    } catch (error: any) {
      logger.error("获取 Master 决策详情失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Agent Teams 配置
   */
  app.get("/api/agent-teams/config", async (c) => {
    try {
      const config = await agentTeamsService.getConfig();
      return c.json(config);
    } catch (error: any) {
      logger.error("获取 Agent Teams 配置失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.patch("/api/agent-teams/config", async (c) => {
    try {
      const body = await c.req.json();
      const patch: Partial<{
        enabled: boolean;
        intervalSeconds: number;
        maxBudgetUsdt: number;
        maxTeamPositions: number;
      }> = {};

      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (typeof body.intervalSeconds === "number") patch.intervalSeconds = body.intervalSeconds;
      if (typeof body.maxBudgetUsdt === "number") patch.maxBudgetUsdt = body.maxBudgetUsdt;
      if (typeof body.maxTeamPositions === "number") patch.maxTeamPositions = body.maxTeamPositions;

      const config = await agentTeamsService.updateConfig(patch);
      await agentTeamsOrchestrator.applyEnabledState(
        config.enabled,
        config.intervalSeconds,
      );
      return c.json(config);
    } catch (error: any) {
      logger.error("更新 Agent Teams 配置失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * Agent Teams 控制接口
   */
  app.post("/api/agent-teams/control/start", async (c) => {
    try {
      const config = await agentTeamsService.updateConfig({ enabled: true });
      await agentTeamsOrchestrator.applyEnabledState(true, config.intervalSeconds);
      return c.json({ success: true, config });
    } catch (error: any) {
      logger.error("启动 Agent Teams 失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post("/api/agent-teams/control/stop", async (c) => {
    try {
      const config = await agentTeamsService.updateConfig({ enabled: false });
      await agentTeamsOrchestrator.applyEnabledState(false, config.intervalSeconds);
      return c.json({ success: true, config });
    } catch (error: any) {
      logger.error("停止 Agent Teams 失败:", error);
      return c.json({ error: error.message }, 500);
    }
  });

  return app;
}
