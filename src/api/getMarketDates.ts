import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { marketDashboardForDate } from "../services/market/marketDashboardService.js";
import { marketDateOverview, safeMarketDateLimit } from "../services/market/marketDatesService.js";
import { assertTradeDate } from "../utils/date.js";
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

async function cachedMarketDateOverview(limit: number) {
  return getOrSetDailyCache(["market", "dates", "v3", limit], async () => marketDateOverview(await getDb(), limit));
}

async function cachedMarketDashboard(date: string) {
  return getOrSetDailyCache(["market", "dashboard", "v1", date], async () => marketDashboardForDate(await getDb(), date));
}

export async function getMarketDashboard(request: HttpRequest, _context: InvocationContext) {
  const dateParam = request.query.get("date");
  if (!dateParam) return badRequest("date is required");
  const date = assertTradeDate(dateParam);
  return jsonResponse(await cachedMarketDashboard(date));
}

export async function getMarketBootstrap(request: HttpRequest, _context: InvocationContext) {
  const parsedLimit = Number(request.query.get("limit") ?? 180);
  if (Number.isNaN(parsedLimit)) return badRequest("numeric limit is required");
  const overview = await cachedMarketDateOverview(safeMarketDateLimit(parsedLimit));
  const requestedDateParam = request.query.get("date");
  const requestedDate = requestedDateParam ? assertTradeDate(requestedDateParam) : null;
  const selectedDate = requestedDate && overview.dates.includes(requestedDate)
    ? requestedDate
    : overview.recommendedDate ?? overview.dates[0] ?? null;
  return jsonResponse({
    ...overview,
    selectedDate,
    dashboard: selectedDate ? await cachedMarketDashboard(selectedDate) : null
  });
}

app.http("getMarketDates", {
  methods: ["GET"],
  route: "market/dates",
  authLevel: "anonymous",
  handler: getMarketDates
});

app.http("getMarketDashboard", {
  methods: ["GET"],
  route: "market/dashboard",
  authLevel: "anonymous",
  handler: getMarketDashboard
});

app.http("getMarketBootstrap", {
  methods: ["GET"],
  route: "market/bootstrap",
  authLevel: "anonymous",
  handler: getMarketBootstrap
});
