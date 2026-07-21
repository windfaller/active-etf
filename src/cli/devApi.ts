import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import type { Db } from "mongodb";
import { configuredEtfs } from "../config/etfs.js";
import { enabledGlobalEtfs, findGlobalEtfConfig, globalEtfCandidates } from "../config/globalEtfs.js";
import { closeDb, getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { getOrSetDailyCache, invalidateDailyCache } from "../services/cache/dailyDataCache.js";
import { calculateConsensus } from "../services/consensus/consensusEngine.js";
import { runActiveEtfDiscovery } from "../services/discovery/activeEtfDiscoveryService.js";
import { runCalculateDailyChangesJob, runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
import {
  handleTelegramUpdate,
  setTelegramWebhook,
  type TelegramUpdate,
  telegramWebhookUrl
} from "../services/notify/telegramSubscriberService.js";
import { calculateSectorFlow } from "../services/sector/sectorFlowEngine.js";
import { refreshStockSectorProfiles } from "../services/sector/sectorProfileSync.js";
import { tagMovementsForChanges } from "../services/sector/tagMovementService.js";
import { stockImpactsForDate } from "../services/market/stockImpactService.js";
import { marketDateOverview, safeMarketDateLimit } from "../services/market/marketDatesService.js";
import { getGlobalEtfDailyReport, syncAllGlobalEtfHoldings, syncGlobalEtfHoldings } from "../services/globalEtf/globalEtfService.js";
import { syncDailyMarketIntelligence } from "../services/sync/marketIntelligenceSync.js";
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

function envFlag(name: string): boolean | null {
  const value = process.env[name];
  if (value === undefined) return null;
  return value.toLowerCase() === "true";
}

function runtimeAdsEnabled(): boolean {
  return envFlag("ENABLE_ADS") ?? envFlag("VITE_ENABLE_ADS") ?? false;
}

function enabledEtfSummaries() {
  return configuredEtfs
    .filter((item) => item.enabled)
    .map((etf) => ({
      etfCode: etf.etfCode,
      name: etf.name,
      issuer: etf.issuer,
      fundCode: etf.fundCode,
      providerId: etf.source.providerId ?? null
    }));
}

async function latestHoldingChangeTradeDate(): Promise<string | null> {
  const db = await getDevDb();
  const latest = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({})
    .sort({ tradeDate: -1 })
    .limit(1)
    .next();

  return latest?.tradeDate ?? null;
}

function telegramAuthError(req: IncomingMessage): { status: number; message: string } | null {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return { status: 500, message: "TELEGRAM_WEBHOOK_SECRET is required" };
  if (req.headers["x-telegram-bot-api-secret-token"] !== expected) return { status: 401, message: "Unauthorized" };
  return null;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

let dbPromise: Promise<Db> | null = null;

function getDevDb(): Promise<Db> {
  dbPromise ??= getDb();
  return dbPromise;
}

async function getDevGlobalEtfReport() {
  try {
    return await getGlobalEtfDailyReport(await getDevDb());
  } catch {
    return getGlobalEtfDailyReport();
  }
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const parts = requestUrl.pathname.split("/").filter(Boolean);

    if (parts[0] !== "api") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (req.method === "GET" && parts[1] === "config") {
      sendJson(res, 200, {
        ads: {
          enabled: runtimeAdsEnabled(),
          trackingEnabled: envFlag("ENABLE_AD_TRACKING") ?? false
        }
      });
      return;
    }

    if (req.method === "GET" && parts[1] === "market" && parts[2] === "stock-impact") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const body = await getOrSetDailyCache(["market", "stock-impact", "v2", date], async () => {
        const db = await getDevDb();
        const changes = await db
          .collection<EtfHoldingChange>("etf_holding_changes")
          .find({ tradeDate: date, diffShares: { $ne: 0 } })
          .toArray();
        return stockImpactsForDate(db, date, changes);
      });

      sendJson(res, 200, body);
      return;
    }

    if (req.method === "GET" && parts[1] === "market" && parts[2] === "dates") {
      const parsedLimit = Number(requestUrl.searchParams.get("limit") ?? 180);
      if (Number.isNaN(parsedLimit)) {
        sendJson(res, 400, { error: "numeric limit is required" });
        return;
      }
      const limit = safeMarketDateLimit(parsedLimit);
      const body = await getOrSetDailyCache(["market", "dates", "v2", limit], async () =>
        marketDateOverview(await getDevDb(), limit)
      );
      sendJson(res, 200, body);
      return;
    }

    if (req.method === "GET" && parts[1] === "etfs" && parts[2] === "coverage") {
      const dateParam = requestUrl.searchParams.get("date");
      const date = dateParam ? assertTradeDate(dateParam) : null;
      const enabledEtfs = configuredEtfs.filter((item) => item.enabled);
      const etfCodes = enabledEtfs.map((item) => item.etfCode);
      const db = await getDevDb();
      const latestRows = await db
        .collection<EtfDailySummary>("etf_daily_summary")
        .aggregate<{ etfCode: string; latestTradeDate: string; updatedAt: Date }>([
          { $match: { etfCode: { $in: etfCodes } } },
          { $sort: { tradeDate: -1 } },
          {
            $group: {
              _id: "$etfCode",
              latestTradeDate: { $first: "$tradeDate" },
              updatedAt: { $first: "$updatedAt" }
            }
          },
          { $project: { _id: 0, etfCode: "$_id", latestTradeDate: 1, updatedAt: 1 } }
        ])
        .toArray();
      const availableOnDate = date
        ? new Set(
            (
              await db
                .collection<EtfDailySummary>("etf_daily_summary")
                .find({ etfCode: { $in: etfCodes }, tradeDate: date }, { projection: { _id: 0, etfCode: 1 } })
                .toArray()
            ).map((row) => row.etfCode)
          )
        : new Set<string>();
      const latestByCode = new Map(latestRows.map((row) => [row.etfCode, row]));
      const etfs = enabledEtfs.map((etf) => {
        const latest = latestByCode.get(etf.etfCode);
        const hasSelectedDate = date ? availableOnDate.has(etf.etfCode) : false;
        const latestTradeDate = latest?.latestTradeDate ?? null;
        const status =
          !date || hasSelectedDate
            ? "available"
            : latestTradeDate === null
              ? "missing"
              : latestTradeDate < date
                ? "stale"
                : "newer_available";

        return {
          etfCode: etf.etfCode,
          name: etf.name,
          issuer: etf.issuer,
          providerId: etf.source.providerId ?? "ezmoney",
          latestTradeDate,
          hasSelectedDate,
          status,
          updatedAt: latest?.updatedAt ?? null
        };
      });

      sendJson(res, 200, {
        date,
        trackedCount: etfs.length,
        availableCount: date ? etfs.filter((etf) => etf.hasSelectedDate).length : 0,
        staleCount: date ? etfs.filter((etf) => etf.status === "stale" || etf.status === "missing").length : 0,
        etfs
      });
      return;
    }

    if (req.method === "GET" && parts[1] === "dashboard") {
      const etfCode = required(requestUrl.searchParams.get("etfCode"), "etfCode");
      const date = assertTradeDate(required(requestUrl.searchParams.get("date"), "date"));
      const body = await getOrSetDailyCache(["dashboard", etfCode, date], async () => {
        const db = await getDevDb();
        const enabledEtfs = configuredEtfs.filter((item) => item.enabled);
        const etfCodes = enabledEtfs.map((item) => item.etfCode);
        const [holdings, summary, etfChanges, summaries, allChanges, latestRows, availableRows] = await Promise.all([
          db
            .collection<EtfDailyHolding>("etf_daily_holdings")
            .find({ etfCode, tradeDate: date })
            .sort({ weight: -1, marketValue: -1 })
            .toArray(),
          db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode, tradeDate: date }),
          db.collection<EtfHoldingChange>("etf_holding_changes").find({ etfCode, tradeDate: date }).toArray(),
          db.collection<EtfDailySummary>("etf_daily_summary").find({ etfCode }).sort({ tradeDate: -1 }).limit(90).toArray(),
          db.collection<EtfHoldingChange>("etf_holding_changes").find({ tradeDate: date, diffShares: { $ne: 0 } }).toArray(),
          db
            .collection<EtfDailySummary>("etf_daily_summary")
            .aggregate<{ etfCode: string; latestTradeDate: string; updatedAt: Date }>([
              { $match: { etfCode: { $in: etfCodes } } },
              { $sort: { tradeDate: -1 } },
              { $group: { _id: "$etfCode", latestTradeDate: { $first: "$tradeDate" }, updatedAt: { $first: "$updatedAt" } } },
              { $project: { _id: 0, etfCode: "$_id", latestTradeDate: 1, updatedAt: 1 } }
            ])
            .toArray(),
          db
            .collection<EtfDailySummary>("etf_daily_summary")
            .find({ etfCode: { $in: etfCodes }, tradeDate: date }, { projection: { _id: 0, etfCode: 1 } })
            .toArray()
        ]);

        const changes = {
          etfCode,
          date,
          topIncreases: etfChanges.filter((change) => change.diffShares > 0).sort((a, b) => b.diffShares - a.diffShares),
          topDecreases: etfChanges.filter((change) => change.diffShares < 0).sort((a, b) => a.diffShares - b.diffShares),
          topActiveIncreases: etfChanges
            .filter((change) => (change.activeDiffShares ?? 0) > 0)
            .sort((a, b) => (b.activeDiffShares ?? 0) - (a.activeDiffShares ?? 0)),
          topActiveDecreases: etfChanges
            .filter((change) => (change.activeDiffShares ?? 0) < 0)
            .sort((a, b) => (a.activeDiffShares ?? 0) - (b.activeDiffShares ?? 0)),
          newHoldings: etfChanges.filter(
            (change) => change.status === "new" || (change.prevShares === 0 && change.currentShares > 0)
          ),
          exitedHoldings: etfChanges.filter(
            (change) => change.status === "exit" || (change.prevShares > 0 && change.currentShares === 0)
          ),
          tagMovements: await tagMovementsForChanges(db, etfChanges)
        };

        const stockImpact = await stockImpactsForDate(db, date, allChanges);

        const availableCodes = new Set(availableRows.map((row) => row.etfCode));
        const latestByCode = new Map(latestRows.map((row) => [row.etfCode, row]));
        const coverageEtfs = enabledEtfs.map((etf) => {
          const latest = latestByCode.get(etf.etfCode);
          const hasSelectedDate = availableCodes.has(etf.etfCode);
          const latestTradeDate = latest?.latestTradeDate ?? null;
          const status = hasSelectedDate
            ? "available"
            : latestTradeDate === null
              ? "missing"
              : latestTradeDate < date
                ? "stale"
                : "newer_available";
          return {
            etfCode: etf.etfCode,
            name: etf.name,
            issuer: etf.issuer,
            providerId: etf.source.providerId ?? "ezmoney",
            latestTradeDate,
            hasSelectedDate,
            status,
            updatedAt: latest?.updatedAt ?? null
          };
        });

        return {
          etfCode,
          date,
          holdings,
          summary,
          changes,
          summaries,
          stockImpact,
          coverage: {
            date,
            trackedCount: coverageEtfs.length,
            availableCount: coverageEtfs.filter((etf) => etf.hasSelectedDate).length,
            staleCount: coverageEtfs.filter((etf) => etf.status === "stale" || etf.status === "missing").length,
            etfs: coverageEtfs
          }
        };
      });

      sendJson(res, 200, body);
      return;
    }

    if (req.method === "GET" && parts[1] === "global-etfs" && parts[2] === "enabled") {
      sendJson(res, 200, {
        productGroup: "global_etf",
        enabled: enabledGlobalEtfs,
        candidates: globalEtfCandidates.filter((etf) => !etf.enabled)
      });
      return;
    }

    if (req.method === "GET" && parts[1] === "global-etfs" && parts[2] === "daily-report") {
      sendJson(res, 200, await getDevGlobalEtfReport());
      return;
    }

    if (req.method === "GET" && parts[1] === "global-etf" && parts[2]) {
      const etfCode = parts[2].toUpperCase();
      if (!findGlobalEtfConfig(etfCode)) {
        sendJson(res, 400, { error: "known global ETF code is required" });
        return;
      }
      const report = await getDevGlobalEtfReport();
      const section = report.sections.find((item) => item.etfCode === etfCode);
      if (parts[3] === "holdings") {
        sendJson(res, 200, { etfCode, date: section?.sourceAsOf ?? null, holdings: section?.topHoldings ?? [], demoMode: report.demoMode });
        return;
      }
      if (parts[3] === "changes") {
        sendJson(res, 200, {
          etfCode,
          date: section?.sourceAsOf ?? null,
          changes: section
            ? {
                newPositions: section.newPositions,
                exitedPositions: section.exitedPositions,
                weightChanges: section.weightChanges,
                shareChanges: section.shareChanges,
                marketValueChanges: section.marketValueChanges,
                sectorChanges: section.sectorChanges,
                countryChanges: section.countryChanges
              }
            : null,
          demoMode: report.demoMode
        });
        return;
      }
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "global-etfs" && parts[3] === "sync-holdings") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const results = await syncAllGlobalEtfHoldings(await getDevDb());
      sendJson(res, 200, { ok: results.every((result) => result.ok), job: "globalEtfsSyncHoldings", results });
      return;
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "global-etf" && parts[4] === "sync-holdings") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const etfCode = required(parts[3] ?? null, "etfCode").toUpperCase();
      const result = await syncGlobalEtfHoldings(await getDevDb(), etfCode);
      sendJson(res, 200, { ok: true, job: "globalEtfSyncHoldings", result });
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
        await invalidateDailyCache(etfCode, result.tradeDate);
        sendJson(res, 200, { ok: true, job: "syncDailyHoldings", result });
        return;
      }

      if (action === "calculate-changes") {
        const dateParam = requestUrl.searchParams.get("date");
        const tradeDate = dateParam ? assertTradeDate(dateParam) : undefined;
        const result = await runCalculateDailyChangesJob(etfCode, tradeDate);
        if (result) await invalidateDailyCache(etfCode, result.tradeDate);
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
            const result = await runSyncDailyHoldingsJob(etf.etfCode);
            await invalidateDailyCache(etf.etfCode, result.tradeDate);
            results.push({
              etfCode: etf.etfCode,
              ok: true,
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
            if (result) await invalidateDailyCache(etf.etfCode, result.tradeDate);
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

      if (action === "enabled") {
        const authError = adminAuthError(req);
        if (authError) {
          sendJson(res, authError.status, { error: authError.message });
          return;
        }

        const etfs = enabledEtfSummaries();
        sendJson(res, 200, { ok: true, job: "enabledEtfs", result: { count: etfs.length, etfs } });
        return;
      }
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "daily-refresh") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const db = await getDevDb();
      let discovery: unknown = null;
      try {
        discovery = await runActiveEtfDiscovery(db, { notify: true });
      } catch (error) {
        discovery = {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }

      const results = [];
      const refreshedTradeDates = new Set<string>();
      for (const etf of configuredEtfs.filter((item) => item.enabled)) {
        try {
          const sync = await runSyncDailyHoldingsJob(etf.etfCode);
          const calculate = await runCalculateDailyChangesJob(etf.etfCode, sync.tradeDate);
          await invalidateDailyCache(etf.etfCode, sync.tradeDate);
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
        const [consensus, sectorFlow, marketIntelligence] = await Promise.all([
          calculateConsensus(db, tradeDate),
          calculateSectorFlow(db, tradeDate),
          syncDailyMarketIntelligence(db, tradeDate)
        ]);
        await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));
        aggregates.push({
          tradeDate,
          consensusRows: consensus.length,
          sectorRows: sectorFlow.length,
          marketIntelligence
        });
      }

      sendJson(res, 200, { ok: results.every((result) => result.ok), job: "dailyRefresh", discovery, results, aggregates });
      return;
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "market-intelligence") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const tradeDate = assertTradeDate(required(requestUrl.searchParams.get("date"), "date"));
      const db = await getDevDb();
      const result = await syncDailyMarketIntelligence(db, tradeDate);
      await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));
      sendJson(res, 200, { ok: result.errors.length === 0, job: "syncMarketIntelligence", result });
      return;
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "aggregates") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const dateParam = requestUrl.searchParams.get("date");
      const tradeDate = dateParam ? assertTradeDate(dateParam) : await latestHoldingChangeTradeDate();
      if (!tradeDate) {
        sendJson(res, 400, { error: "date is required when no holding changes exist yet" });
        return;
      }

      const db = await getDevDb();
      const [consensus, sectorFlow, marketIntelligence] = await Promise.all([
        calculateConsensus(db, tradeDate),
        calculateSectorFlow(db, tradeDate),
        syncDailyMarketIntelligence(db, tradeDate)
      ]);
      await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));
      sendJson(res, 200, {
        ok: marketIntelligence.errors.length === 0,
        job: "dailyAggregates",
        result: {
          tradeDate,
          consensusRows: consensus.length,
          sectorRows: sectorFlow.length,
          marketIntelligence
        }
      });
      return;
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "sector-profiles" && parts[3] === "refresh") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const db = await getDevDb();
      const result = await refreshStockSectorProfiles(db);
      const tradeDate = await latestHoldingChangeTradeDate();
      if (tradeDate) {
        await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));
      }
      sendJson(res, 200, { ok: true, job: "refreshSectorProfiles", result, cacheInvalidatedTradeDate: tradeDate });
      return;
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "discover-active-etfs") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const db = await getDevDb();
      const notify = requestUrl.searchParams.get("notify") === "true";
      const result = await runActiveEtfDiscovery(db, { notify });
      sendJson(res, 200, { ok: true, job: "discoverActiveEtfs", result });
      return;
    }

    if (req.method === "POST" && parts[1] === "jobs" && parts[2] === "telegram" && parts[3] === "set-webhook") {
      const authError = adminAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const result = await setTelegramWebhook();
      sendJson(res, 200, { ok: true, job: "telegramSetWebhook", webhookUrl: telegramWebhookUrl(), result });
      return;
    }

    if (req.method === "POST" && parts[1] === "telegram" && parts[2] === "webhook") {
      const authError = telegramAuthError(req);
      if (authError) {
        sendJson(res, authError.status, { error: authError.message });
        return;
      }

      const db = await getDevDb();
      const result = await handleTelegramUpdate(db, (await readJsonBody(req)) as TelegramUpdate);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && parts[1] === "telegram" && parts[2] === "info") {
      const configuredUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/u, "") ?? null;
      sendJson(res, 200, {
        configured: Boolean(configuredUsername || process.env.TELEGRAM_BOT_TOKEN),
        username: configuredUsername,
        subscribeUrl: configuredUsername ? `https://t.me/${configuredUsername}?start=subscribe` : null
      });
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
      const body = await getOrSetDailyCache(["etf", "active", "ranking", date], async () => {
        const db = await getDevDb();
        const ranking = await db
          .collection<EtfHoldingChange>("etf_holding_changes")
          .find({ tradeDate: date, activeSignalScore: { $ne: null } })
          .sort({ activeSignalScore: -1, activeDiffShares: -1 })
          .limit(100)
          .toArray();

        return { date, ranking };
      });
      sendJson(res, 200, body);
      return;
    }

    const etfCode = parts[2];
    const action = parts[3];

    if (action === "dates") {
      const limit = Math.min(365, Math.max(1, Number(requestUrl.searchParams.get("limit") ?? 120)));
      const body = await getOrSetDailyCache(["etf", etfCode, "dates", limit], async () => {
        const db = await getDevDb();
        const rows = await db
          .collection<EtfDailyHolding>("etf_daily_holdings")
          .aggregate<{ tradeDate: string }>([
            { $match: { etfCode } },
            { $group: { _id: "$tradeDate" } },
            { $sort: { _id: -1 } },
            { $limit: limit },
            { $project: { _id: 0, tradeDate: "$_id" } }
          ])
          .toArray();

        return { etfCode, dates: rows.map((row) => row.tradeDate) };
      });
      sendJson(res, 200, body);
      return;
    }

    if (action === "holdings") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const body = await getOrSetDailyCache(["etf", etfCode, "holdings", date], async () => {
        const db = await getDevDb();
        const holdings = await db
          .collection<EtfDailyHolding>("etf_daily_holdings")
          .find({ etfCode, tradeDate: date })
          .sort({ weight: -1, marketValue: -1 })
          .toArray();

        return { etfCode, date, holdings };
      });
      sendJson(res, 200, body);
      return;
    }

    if (action === "summary") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const body = await getOrSetDailyCache(["etf", etfCode, "summary", date], async () => {
        const db = await getDevDb();
        const summary = await db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode, tradeDate: date });
        return { etfCode, date, summary };
      });
      sendJson(res, 200, body);
      return;
    }

    if (action === "summary-history") {
      const limit = Math.min(180, Math.max(1, Number(requestUrl.searchParams.get("limit") ?? 90)));
      const body = await getOrSetDailyCache(["etf", etfCode, "summary-history", limit], async () => {
        const db = await getDevDb();
        const summaries = await db
          .collection<EtfDailySummary>("etf_daily_summary")
          .find({ etfCode })
          .sort({ tradeDate: -1 })
          .limit(limit)
          .toArray();

        return { etfCode, summaries };
      });
      sendJson(res, 200, body);
      return;
    }

    if (action === "changes") {
      const date = required(requestUrl.searchParams.get("date"), "date");
      const body = await getOrSetDailyCache(["etf", etfCode, "changes", date], async () => {
        const db = await getDevDb();
        const changes = await db
          .collection<EtfHoldingChange>("etf_holding_changes")
          .find({ etfCode, tradeDate: date })
          .toArray();

        return {
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
          ),
          tagMovements: await tagMovementsForChanges(db, changes)
        };
      });
      sendJson(res, 200, body);
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
