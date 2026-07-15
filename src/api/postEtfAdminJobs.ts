import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { getDb } from "../db/mongo.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { invalidateDailyCache } from "../services/cache/dailyDataCache.js";
import { calculateConsensus } from "../services/consensus/consensusEngine.js";
import { runActiveEtfDiscovery } from "../services/discovery/activeEtfDiscoveryService.js";
import { syncAllGlobalEtfHoldings } from "../services/globalEtf/globalEtfService.js";
import { runCalculateDailyChangesJob, runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
import { sendTelegramDailyDigest } from "../services/notify/dailyDigestJob.js";
import { setTelegramWebhook, telegramWebhookUrl } from "../services/notify/telegramSubscriberService.js";
import { calculateSectorFlow } from "../services/sector/sectorFlowEngine.js";
import { refreshStockSectorProfiles } from "../services/sector/sectorProfileSync.js";
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
  const db = await getDb();
  const latest = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({})
    .sort({ tradeDate: -1 })
    .limit(1)
    .next();

  return latest?.tradeDate ?? null;
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

export async function postEnabledEtfs(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const etfs = enabledEtfSummaries();
  return jsonResponse({ ok: true, job: "enabledEtfs", result: { count: etfs.length, etfs } });
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

  const globalEtfs = await syncAllGlobalEtfHoldings(db);

  return jsonResponse({
    ok: results.every((result) => result.ok) && globalEtfs.every((result) => result.ok),
    job: "dailyRefresh",
    discovery,
    results,
    aggregates,
    globalEtfs
  });
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

export async function postDailyAggregates(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const dateParam = request.query.get("date");
  const tradeDate = dateParam ? assertTradeDate(dateParam) : await latestHoldingChangeTradeDate();
  if (!tradeDate) return badRequest("date is required when no holding changes exist yet");

  const db = await getDb();
  const [consensus, sectorFlow, marketIntelligence] = await Promise.all([
    calculateConsensus(db, tradeDate),
    calculateSectorFlow(db, tradeDate),
    syncDailyMarketIntelligence(db, tradeDate)
  ]);

  await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));

  return jsonResponse({
    ok: marketIntelligence.errors.length === 0,
    job: "dailyAggregates",
    result: {
      tradeDate,
      consensusRows: consensus.length,
      sectorRows: sectorFlow.length,
      marketIntelligence
    }
  });
}

export async function postRefreshSectorProfiles(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const db = await getDb();
  const result = await refreshStockSectorProfiles(db);
  const tradeDate = await latestHoldingChangeTradeDate();
  if (tradeDate) {
    await Promise.all(configuredEtfs.filter((item) => item.enabled).map((etf) => invalidateDailyCache(etf.etfCode, tradeDate)));
  }

  return jsonResponse({ ok: true, job: "refreshSectorProfiles", result, cacheInvalidatedTradeDate: tradeDate });
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

export async function postTelegramDailyDigest(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const etfCode = request.query.get("etfCode") ?? undefined;
  const dateParam = request.query.get("date");
  const tradeDate = dateParam ? assertTradeDate(dateParam) : undefined;
  const db = await getDb();
  try {
    const result = await sendTelegramDailyDigest(db, { etfCode, tradeDate });
    return jsonResponse({ ok: true, job: "telegramDailyDigest", result });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        job: "telegramDailyDigest",
        error: error instanceof Error ? error.message : String(error)
      },
      400
    );
  }
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

app.http("postEnabledEtfs", {
  methods: ["POST"],
  route: "jobs/etfs/enabled",
  authLevel: "anonymous",
  handler: postEnabledEtfs
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

app.http("postDailyAggregates", {
  methods: ["POST"],
  route: "jobs/aggregates",
  authLevel: "anonymous",
  handler: postDailyAggregates
});

app.http("postRefreshSectorProfiles", {
  methods: ["POST"],
  route: "jobs/sector-profiles/refresh",
  authLevel: "anonymous",
  handler: postRefreshSectorProfiles
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

app.http("postTelegramDailyDigest", {
  methods: ["POST"],
  route: "jobs/telegram/daily-digest",
  authLevel: "anonymous",
  handler: postTelegramDailyDigest
});
