import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { stockImpactsForDate } from "../services/market/stockImpactService.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getMarketStockImpact(request: HttpRequest, _context: InvocationContext) {
  const date = request.query.get("date");
  if (!date) return badRequest("date is required");

  const body = await getOrSetDailyCache(["market", "stock-impact", date], async () => {
    const db = await getDb();
    const changes = await db
      .collection<EtfHoldingChange>("etf_holding_changes")
      .find({ tradeDate: date, diffShares: { $ne: 0 } })
      .toArray();

    return stockImpactsForDate(db, date, changes);
  });

  return jsonResponse(body);
}

app.http("getMarketStockImpact", {
  methods: ["GET"],
  route: "market/stock-impact",
  authLevel: "anonymous",
  handler: getMarketStockImpact
});
