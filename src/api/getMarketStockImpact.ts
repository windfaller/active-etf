import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { stockImpactsForDate } from "../services/market/stockImpactService.js";
import { projectStockImpactForMember } from "./memberProjection.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";
import { badRequest } from "./response.js";

export async function getMarketStockImpact(request: HttpRequest, _context: InvocationContext) {
  const date = request.query.get("date");
  if (!date) return badRequest("date is required");

  const body = await getOrSetDailyCache(["market", "stock-impact", "v2", date], async () => {
    const db = await getDb();
    const changes = await db
      .collection<EtfHoldingChange>("etf_holding_changes")
      .find({ tradeDate: date, diffShares: { $ne: 0 } })
      .toArray();

    return stockImpactsForDate(db, date, changes);
  });

  const access = await memberRequestAccess(request);
  return memberJsonResponse(projectStockImpactForMember(body, access.authenticated));
}

app.http("getMarketStockImpact", {
  methods: ["GET"],
  route: "market/stock-impact",
  authLevel: "anonymous",
  handler: getMarketStockImpact
});
