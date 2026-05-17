import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getEtfSummary(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  const date = request.query.get("date");
  if (!etfCode || !date) return badRequest("etfCode and date are required");

  const db = await getDb();
  const summary = await db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode, tradeDate: date });

  return jsonResponse({ etfCode, date, summary });
}

app.http("getEtfSummary", {
  methods: ["GET"],
  route: "etf/{etfCode}/summary",
  authLevel: "function",
  handler: getEtfSummary
});
