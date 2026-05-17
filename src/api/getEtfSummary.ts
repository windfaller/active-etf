import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getEtfSummary(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  const date = request.query.get("date");
  if (!etfCode || !date) return badRequest("etfCode and date are required");

  const body = await getOrSetDailyCache(["etf", etfCode, "summary", date], async () => {
    const db = await getDb();
    const summary = await db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode, tradeDate: date });

    return { etfCode, date, summary };
  });

  return jsonResponse(body);
}

app.http("getEtfSummary", {
  methods: ["GET"],
  route: "etf/{etfCode}/summary",
  authLevel: "anonymous",
  handler: getEtfSummary
});
