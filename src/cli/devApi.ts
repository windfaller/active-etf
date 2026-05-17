import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { configuredEtfs } from "../config/etfs.js";
import { closeDb, getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { calculateConsensus } from "../services/consensus/consensusEngine.js";
import { runCalculateDailyChangesJob, runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
import { calculateSectorFlow } from "../services/sector/sectorFlowEngine.js";
import { assertTradeDate } from "../utils/date.js";

const port = Number(process.env.PORT ?? 7071);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(body, null, 2));
}

function required(value: string | null, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function adminAuthError(req: IncomingMessage): { status: number; message: string } | null {
  const expected = process.env.ADMIN_JOB_TOKEN;
  if (!expected) return { status: 500, message: "ADMIN_JOB_TOKEN is required" };
  if (req.headers["x-admin-token"] !== expected) return { status: 401, message: "Unauthorized" };
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    const db = await getDb();

    if (parts[0] !== "api") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (req.method === "GET" && parts[1] === "market" && parts[2] === "stock-impact") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const changes = await db
        .collection<EtfHoldingChange>("etf_holding_changes")
        .find({ tradeDate: date, diffShares: { $ne: 0 } })
        .toArray();
      const rowsByStock = new Map<string, any>();

      for (const change of changes) {
        const row =
          rowsByStock.get(change.stockId) ??
          {
            stockId: change.stockId,
            stockName: change.stockName,
            etfCount: 0,
            increaseEtfCount: 0,
            decreaseEtfCount: 0,
            totalDiffLots: 0,
            totalActiveDiffLots: 0,
            totalDiffWeightPoint: 0,
            maxAbsActiveDiffLots: 0,
            maxAbsDiffWeightPoint: 0,
            impactScore: 0,
            primaryImpactEtf: null,
            etfs: []
          };
        const activeDiffLots = change.activeDiffLots ?? change.diffLots;
        const diffWeightPoint = change.diffWeightPoint ?? 0;
        const etfImpact = {
          etfCode: change.etfCode,
          diffLots: change.diffLots,
          activeDiffLots: change.activeDiffLots,
          diffWeightPoint: change.diffWeightPoint,
          currentWeight: change.currentWeight,
          status: change.status
        };
        const primaryMagnitude = Math.abs(row.primaryImpactEtf?.activeDiffLots ?? row.primaryImpactEtf?.diffLots ?? 0);

        row.etfs.push(etfImpact);
        row.etfCount += 1;
        row.increaseEtfCount += activeDiffLots > 0 ? 1 : 0;
        row.decreaseEtfCount += activeDiffLots < 0 ? 1 : 0;
        row.totalDiffLots += change.diffLots;
        row.totalActiveDiffLots += activeDiffLots;
        row.totalDiffWeightPoint += diffWeightPoint;
        row.maxAbsActiveDiffLots = Math.max(row.maxAbsActiveDiffLots, Math.abs(activeDiffLots));
        row.maxAbsDiffWeightPoint = Math.max(row.maxAbsDiffWeightPoint, Math.abs(diffWeightPoint));
        if (!row.primaryImpactEtf || Math.abs(activeDiffLots) > primaryMagnitude) row.primaryImpactEtf = etfImpact;
        rowsByStock.set(change.stockId, row);
      }

      const impacts = [...rowsByStock.values()]
        .map((row) => ({
          ...row,
          impactScore: Math.round(row.maxAbsActiveDiffLots * 100 + row.maxAbsDiffWeightPoint * 10000) / 100
        }))
        .sort((a, b) => b.impactScore - a.impactScore);

      sendJson(res, 200, { date, impacts });
      return;
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "etf") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const etfCode = required(parts[3] ?? null, "etfCode");
      const action = parts[4];

      if (action === "sync-holdings") {
        const result = await runSyncDailyHoldingsJob(etfCode);
        sendJson(res, 200, { ok: true, job: "syncDailyHoldings", result });
        return;
      }

      if (action === "calculate-changes") {
        const dateParam = requestUrl.searchParams.get("date");
        const tradeDate = dateParam ? assertTradeDate(dateParam) : undefined;
        const result = await runCalculateDailyChangesJob(etfCode, tradeDate);
        sendJson(res, 200, { ok: result !== null, job: "calculateDailyChanges", result });
        return;
      }
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "etfs") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const action = parts[3];

      if (action === "sync-holdings") {
        const results = [];
        for (const etf of configuredEtfs.filter((item) => item.enabled)) {
          try {
            results.push({
              etfCode: etf.etfCode,
              ok: true,
              result: await runSyncDailyHoldingsJob(etf.etfCode)
            });
          } catch (error) {
            results.push({
              etfCode: etf.etfCode,
              ok: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        sendJson(res, 200, { ok: results.every((result) => result.ok), job: "syncDailyHoldingsAll", results });
        return;
      }

      if (action === "calculate-changes") {
        const dateParam = requestUrl.searchParams.get("date");
        const tradeDate = dateParam ? assertTradeDate(dateParam) : undefined;
        const results = [];
        for (const etf of configuredEtfs.filter((item) => item.enabled)) {
          try {
            const result = await runCalculateDailyChangesJob(etf.etfCode, tradeDate);
            results.push({
              etfCode: etf.etfCode,
              ok: result !== null,
              result
            });
          } catch (error) {
            results.push({
              etfCode: etf.etfCode,
              ok: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        sendJson(res, 200, { ok: results.every((result) => result.ok), job: "calculateDailyChangesAll", results });
        return;
      }
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "daily-refresh") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const results = [];
      const refreshedTradeDates = new Set<string>();
      for (const etf of configuredEtfs.filter((item) => item.enabled)) {
        try {
          const sync = await runSyncDailyHoldingsJob(etf.etfCode);
          const calculate = await runCalculateDailyChangesJob(etf.etfCode, sync.tradeDate);
          refreshedTradeDates.add(sync.tradeDate);
          results.push({
            etfCode: etf.etfCode,
            ok: true,
            sync,
            calculate
          });
        } catch (error) {
          results.push({
            etfCode: etf.etfCode,
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const aggregates = [];
      for (const tradeDate of refreshedTradeDates) {
        const [consensus, sectorFlow] = await Promise.all([
          calculateConsensus(db, tradeDate),
          calculateSectorFlow(db, tradeDate)
        ]);
        aggregates.push({
          tradeDate,
          consensusRows: consensus.length,
          sectorRows: sectorFlow.length
        });
      }

      sendJson(res, 200, { ok: results.every((result) => result.ok), job: "dailyRefresh", results, aggregates });
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    if (parts[1] !== "etf") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (parts[2] === "active" && parts[3] === "ranking") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const ranking = await db
        .collection<EtfHoldingChange>("etf_holding_changes")
        .find({ tradeDate: date, activeSignalScore: { $ne: null } })
        .sort({ activeSignalScore: -1, activeDiffShares: -1 })
        .limit(100)
        .toArray();
      sendJson(res, 200, { date, ranking });
      return;
    }

    const etfCode = parts[2];
    const action = parts[3];

    if (action === "holdings") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const holdings = await db
        .collection<EtfDailyHolding>("etf_daily_holdings")
        .find({ etfCode, tradeDate: date })
        .sort({ weight: -1, marketValue: -1 })
        .toArray();
      sendJson(res, 200, { etfCode, date, holdings });
      return;
    }

    if (action === "summary") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const summary = await db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode, tradeDate: date });
      sendJson(res, 200, { etfCode, date, summary });
      return;
    }

    if (action === "summary-history") {
      const limit = Math.min(180, Math.max(1, Number(requestUrl.searchParams.get("limit") ?? 90)));
      const summaries = await db
        .collection<EtfDailySummary>("etf_daily_summary")
        .find({ etfCode })
        .sort({ tradeDate: -1 })
        .limit(limit)
        .toArray();
      sendJson(res, 200, { etfCode, summaries });
      return;
    }

    if (action === "changes") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const changes = await db
        .collection<EtfHoldingChange>("etf_holding_changes")
        .find({ etfCode, tradeDate: date })
        .toArray();
      sendJson(res, 200, {
        etfCode,
        date,
        topIncreases: changes.filter((change) => change.diffShares > 0).sort((a, b) => b.diffShares - a.diffShares),
        topDecreases: changes.filter((change) => change.diffShares < 0).sort((a, b) => a.diffShares - b.diffShares),
        topActiveIncreases: changes
          .filter((change) => (change.activeDiffShares ?? 0) > 0)
          .sort((a, b) => (b.activeDiffShares ?? 0) - (a.activeDiffShares ?? 0)),
        topActiveDecreases: changes
          .filter((change) => (change.activeDiffShares ?? 0) < 0)
          .sort((a, b) => (a.activeDiffShares ?? 0) - (b.activeDiffShares ?? 0)),
        newHoldings: changes.filter(
          (change) => change.status === "new" || (change.prevShares === 0 && change.currentShares > 0)
        ),
        exitedHoldings: changes.filter(
          (change) => change.status === "exit" || (change.prevShares > 0 && change.currentShares === 0)
        )
      });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  console.log(`ETF dev API listening on http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
