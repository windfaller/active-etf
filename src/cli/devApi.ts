import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { closeDb, getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { runCalculateDailyChangesJob, runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
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

function isAuthorizedAdminRequest(req: IncomingMessage): boolean {
  const expected = process.env.ADMIN_JOB_TOKEN;
  if (!expected) return true;
  return req.headers["x-admin-token"] === expected;
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

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "etf") {
      if (!isAuthorizedAdminRequest(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
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
    const date = required(requestUrl.searchParams.get("date"), "date");

    if (action === "holdings") {
      const holdings = await db
        .collection<EtfDailyHolding>("etf_daily_holdings")
        .find({ etfCode, tradeDate: date })
        .sort({ weight: -1, marketValue: -1 })
        .toArray();
      sendJson(res, 200, { etfCode, date, holdings });
      return;
    }

    if (action === "summary") {
      const summary = await db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode, tradeDate: date });
      sendJson(res, 200, { etfCode, date, summary });
      return;
    }

    if (action === "changes") {
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
