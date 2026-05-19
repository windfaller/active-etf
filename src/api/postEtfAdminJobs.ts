import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { getDb } from "../db/mongo.js";
import { invalidateDailyCache } from "../services/cache/dailyDataCache.js";
import { calculateConsensus } from "../services/consensus/consensusEngine.js";
import { runActiveEtfDiscovery } from "../services/discovery/activeEtfDiscoveryService.js";
import { runCalculateDailyChangesJob, runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
import { setTelegramWebhook, telegramWebhookUrl } from "../services/notify/telegramSubscriberService.js";
import { calculateSectorFlow } from "../services/sector/sectorFlowEngine.js";
import { syncDailyMarketIntelligence } from "../services/sync/marketIntelligenceSync.js";
import { assertTradeDate } from "../utils/date.js";
import { badRequest, jsonResponse, serverError, unauthorized } from "./response.js";

function validateAdminToken(request: HttpRequest) {
  const expected = process.env.ADMIN_JOB_TOKEN;
  if (!expected) return serverError("ADMIN_JOB_TOKEN is required");

  const actual = request.headers.get("x-admin-token");
  if (actual !== expected) return unauthorized();
  return null;
}

export async function postEtfSyncHoldings(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const etfCode = request.params.etfCode;
  if (!etfCode) return badRequest("etfCode is required");

  const result = await runSyncDailyHoldingsJob(etfCode);
  return jsonResponse({ ok: true, job: "syncDailyHoldings", result });
}

export async function postEtfCalculateChanges(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const etfCode = request.params.etfCode;
  if (!etfCode) return badRequest("etfCode is required");

  const dateParam = request.query.get("date");
  const tradeDate = dateParam ? assertTradeDate(dateParam) : undefined;
  const result = await runCalculateDailyChangesJob(etfCode, tradeDate);
  return jsonResponse({ ok: result !== null, job: "calculateDailyChanges", result });
}

export async function postAllEtfsSyncHoldings(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

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

  return jsonResponse({ ok: results.every((result) => result.ok), job: "syncDailyHoldingsAll", results });
}

export async function postAllEtfsCalculateChanges(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const dateParam = request.query.get("date");
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

  return jsonResponse({ ok: results.every((result) => result.ok), job: "calculateDailyChangesAll", results });
}

export async function postDailyRefresh(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const db = await getDb();
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
      const syncResult = await runSyncDailyHoldingsJob(etf.etfCode);
      const calculateResult = await runCalculateDailyChangesJob(etf.etfCode, syncResult.tradeDate);
      refreshedTradeDates.add(syncResult.tradeDate);
      results.push({
        etfCode: etf.etfCode,
        ok: true,
        sync: syncResult,
        calculate: calculateResult
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
    aggregates.push({
      tradeDate,
      consensusRows: consensus.length,
      sectorRows: sectorFlow.length,
      marketIntelligence
    });
    await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));
  }

  return jsonResponse({ ok: results.every((result) => result.ok), job: "dailyRefresh", discovery, results, aggregates });
}

export async function postSyncMarketIntelligence(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const dateParam = request.query.get("date");
  if (!dateParam) return badRequest("date is required");

  const tradeDate = assertTradeDate(dateParam);
  const db = await getDb();
  const result = await syncDailyMarketIntelligence(db, tradeDate);
  await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));
  return jsonResponse({ ok: result.errors.length === 0, job: "syncMarketIntelligence", result });
}

export async function postDiscoverActiveEtfs(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const notify = request.query.get("notify") === "true";
  const db = await getDb();
  const result = await runActiveEtfDiscovery(db, { notify });
  return jsonResponse({ ok: true, job: "discoverActiveEtfs", result });
}

export async function postTelegramSetWebhook(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const result = await setTelegramWebhook();
  return jsonResponse({ ok: true, job: "telegramSetWebhook", webhookUrl: telegramWebhookUrl(), result });
}

app.http("postEtfSyncHoldings", {
  methods: ["POST"],
  route: "jobs/etf/{etfCode}/sync-holdings",
  authLevel: "anonymous",
  handler: postEtfSyncHoldings
});

app.http("postEtfCalculateChanges", {
  methods: ["POST"],
  route: "jobs/etf/{etfCode}/calculate-changes",
  authLevel: "anonymous",
  handler: postEtfCalculateChanges
});

app.http("postAllEtfsSyncHoldings", {
  methods: ["POST"],
  route: "jobs/etfs/sync-holdings",
  authLevel: "anonymous",
  handler: postAllEtfsSyncHoldings
});

app.http("postAllEtfsCalculateChanges", {
  methods: ["POST"],
  route: "jobs/etfs/calculate-changes",
  authLevel: "anonymous",
  handler: postAllEtfsCalculateChanges
});

app.http("postDailyRefresh", {
  methods: ["POST"],
  route: "jobs/daily-refresh",
  authLevel: "anonymous",
  handler: postDailyRefresh
});

app.http("postSyncMarketIntelligence", {
  methods: ["POST"],
  route: "jobs/market-intelligence",
  authLevel: "anonymous",
  handler: postSyncMarketIntelligence
});

app.http("postDiscoverActiveEtfs", {
  methods: ["POST"],
  route: "jobs/discover-active-etfs",
  authLevel: "anonymous",
  handler: postDiscoverActiveEtfs
});

app.http("postTelegramSetWebhook", {
  methods: ["POST"],
  route: "jobs/telegram/set-webhook",
  authLevel: "anonymous",
  handler: postTelegramSetWebhook
});
