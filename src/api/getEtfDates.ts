import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getEtfDates(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  const limitParam = request.query.get("limit");
  const limit = Math.min(365, Math.max(1, Number(limitParam ?? 120)));
  if (!etfCode || Number.isNaN(limit)) return badRequest("etfCode and numeric limit are required");

  const body = await getOrSetDailyCache(["etf", etfCode, "dates", limit], async () => {
    const db = await getDb();
    const rows = await db
      .collection<EtfDailyHolding>("etf_daily_holdings")
      .aggregate<{ tradeDate: string }>([
        { $match: { etfCode } },
        { $group: { _id: "$tradeDate" } },
        { $sort: { _id: -1 } },
        { $limit: limit },
        { $project: { _id: 0, tradeDate: "$_id" } }
      ])
      .toArray();

    return { etfCode, dates: rows.map((row) => row.tradeDate) };
  });

  return jsonResponse(body);
}

app.http("getEtfDates", {
  methods: ["GET"],
  route: "etf/{etfCode}/dates",
  authLevel: "anonymous",
  handler: getEtfDates
});
