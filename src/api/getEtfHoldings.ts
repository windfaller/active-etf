import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getEtfHoldings(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  const date = request.query.get("date");
  if (!etfCode || !date) return badRequest("etfCode and date are required");

  const db = await getDb();
  const holdings = await db
    .collection<EtfDailyHolding>("etf_daily_holdings")
    .find({ etfCode, tradeDate: date })
    .sort({ weight: -1, marketValue: -1 })
    .toArray();

  return jsonResponse({ etfCode, date, holdings });
}

app.http("getEtfHoldings", {
  methods: ["GET"],
  route: "etf/{etfCode}/holdings",
  authLevel: "anonymous",
  handler: getEtfHoldings
});
