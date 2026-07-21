import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { marketDateOverview, safeMarketDateLimit } from "../services/market/marketDatesService.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getMarketDates(request: HttpRequest, _context: InvocationContext) {
  const limitParam = request.query.get("limit");
  const parsedLimit = Number(limitParam ?? 180);
  if (Number.isNaN(parsedLimit)) return badRequest("numeric limit is required");
  const limit = safeMarketDateLimit(parsedLimit);

  const body = await getOrSetDailyCache(["market", "dates", "v3", limit], async () =>
    marketDateOverview(await getDb(), limit)
  );

  return jsonResponse(body);
}

app.http("getMarketDates", {
  methods: ["GET"],
  route: "market/dates",
  authLevel: "anonymous",
  handler: getMarketDates
});
