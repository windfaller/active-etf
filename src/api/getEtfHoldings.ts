import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getEtfHoldings(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  const date = request.query.get("date");
  if (!etfCode || !date) return badRequest("etfCode and date are required");

  const body = await getOrSetDailyCache(["etf", etfCode, "holdings", date], async () => {
    const db = await getDb();
    const holdings = await db
      .collection<EtfDailyHolding>("etf_daily_holdings")
      .find({ etfCode, tradeDate: date })
      .sort({ weight: -1, marketValue: -1 })
      .toArray();

    return { etfCode, date, holdings };
  });

  return jsonResponse(body);
}

app.http("getEtfHoldings", {
  methods: ["GET"],
  route: "etf/{etfCode}/holdings",
  authLevel: "anonymous",
  handler: getEtfHoldings
});
