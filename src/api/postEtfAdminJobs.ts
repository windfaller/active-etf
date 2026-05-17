import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { runCalculateDailyChangesJob, runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
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
