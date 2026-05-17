import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { runCalculateDailyChangesJob, runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
import { assertTradeDate } from "../utils/date.js";
import { badRequest, jsonResponse } from "./response.js";

export async function postEtfSyncHoldings(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  if (!etfCode) return badRequest("etfCode is required");

  const result = await runSyncDailyHoldingsJob(etfCode);
  return jsonResponse({ ok: true, job: "syncDailyHoldings", result });
}

export async function postEtfCalculateChanges(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  if (!etfCode) return badRequest("etfCode is required");

  const dateParam = request.query.get("date");
  const tradeDate = dateParam ? assertTradeDate(dateParam) : undefined;
  const result = await runCalculateDailyChangesJob(etfCode, tradeDate);
  return jsonResponse({ ok: result !== null, job: "calculateDailyChanges", result });
}

app.http("postEtfSyncHoldings", {
  methods: ["POST"],
  route: "admin/etf/{etfCode}/sync-holdings",
  authLevel: "function",
  handler: postEtfSyncHoldings
});

app.http("postEtfCalculateChanges", {
  methods: ["POST"],
  route: "admin/etf/{etfCode}/calculate-changes",
  authLevel: "function",
  handler: postEtfCalculateChanges
});
