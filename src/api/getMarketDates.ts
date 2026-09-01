import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { marketDashboardForDate } from "../services/market/marketDashboardService.js";
import { marketDateOverview, safeMarketDateLimit } from "../services/market/marketDatesService.js";
import { assertTradeDate } from "../utils/date.js";
import { projectMarketDashboardForMember } from "./memberProjection.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";
import { badRequest, edgeCachedJsonResponse, withServerTiming } from "./response.js";

export async function getMarketDates(request: HttpRequest, _context: InvocationContext) {
  const startedAt = Date.now();
  const limitParam = request.query.get("limit");
  const parsedLimit = Number(limitParam ?? 180);
  if (Number.isNaN(parsedLimit)) return badRequest("numeric limit is required");
  const limit = safeMarketDateLimit(parsedLimit);

  const body = await getOrSetDailyCache(["market", "dates", "v3", limit], async () =>
    marketDateOverview(await getDb(), limit)
  );

  return withServerTiming(edgeCachedJsonResponse(body), [
    { name: "total", duration: Date.now() - startedAt },
    { name: "market-dates", duration: Date.now() - startedAt }
  ]);
}

async function cachedMarketDateOverview(limit: number) {
  return getOrSetDailyCache(["market", "dates", "v3", limit], async () => marketDateOverview(await getDb(), limit));
}

async function cachedMarketDashboard(date: string) {
  return getOrSetDailyCache(["market", "dashboard", "v1", date], async () => marketDashboardForDate(await getDb(), date));
}

export async function getMarketDashboard(request: HttpRequest, _context: InvocationContext) {
  const startedAt = Date.now();
  const dateParam = request.query.get("date");
  if (!dateParam) return badRequest("date is required");
  const date = assertTradeDate(dateParam);
  const dashboard = await cachedMarketDashboard(date);
  const access = await memberRequestAccess(request);
  const projected = projectMarketDashboardForMember(dashboard, access.authenticated);
  return withServerTiming(memberJsonResponse(projected), [
    { name: "total", duration: Date.now() - startedAt },
    { name: "market-dashboard", duration: Date.now() - startedAt }
  ]);
}

export async function getMarketBootstrap(request: HttpRequest, _context: InvocationContext) {
  const startedAt = Date.now();
  const parsedLimit = Number(request.query.get("limit") ?? 180);
  if (Number.isNaN(parsedLimit)) return badRequest("numeric limit is required");
  const datesStartedAt = Date.now();
  const overview = await cachedMarketDateOverview(safeMarketDateLimit(parsedLimit));
  const datesDuration = Date.now() - datesStartedAt;
  const requestedDateParam = request.query.get("date");
  const requestedDate = requestedDateParam ? assertTradeDate(requestedDateParam) : null;
  const selectedDate = requestedDate && overview.dates.includes(requestedDate)
    ? requestedDate
    : overview.recommendedDate ?? overview.dates[0] ?? null;
  const dashboardStartedAt = Date.now();
  const dashboard = selectedDate ? await cachedMarketDashboard(selectedDate) : null;
  const access = await memberRequestAccess(request);
  return withServerTiming(memberJsonResponse({
    ...overview,
    selectedDate,
    dashboard: dashboard ? projectMarketDashboardForMember(dashboard, access.authenticated) : null
  }), [
    { name: "total", duration: Date.now() - startedAt },
    { name: "market-dates", duration: datesDuration },
    { name: "market-dashboard", duration: Date.now() - dashboardStartedAt }
  ]);
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
