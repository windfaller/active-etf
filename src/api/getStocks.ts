import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { maskMemberResults, maskMemberResultsByStableKey } from "../domain/memberAccess.js";
import type { Db } from "mongodb";
import { BoundedRequestCache } from "../services/cache/boundedRequestCache.js";
import { enabledDailyGlobalEtfCodes, enabledInstitutionCodes, enabledTaiwanEtfCodes } from "../services/intelligence/dataAccess.js";
import { stockEtfs, stockHistory, stockInstitutions, stockOverview, searchStocks, type StockMarket } from "../services/intelligence/stockIntelligenceService.js";
import { badRequest, cachedJsonResponse, jsonResponse, notFound, withServerTiming } from "./response.js";
import { getTimedCached } from "./timedRequestCache.js";
import { limitSchema, marketSchema, normalizedStockSymbol, optionalDate, querySchema, stockSymbolSchema, windowSchema } from "./intelligenceValidation.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";

const requestCache = new BoundedRequestCache();
const requestCacheTtlMilliseconds = 180_000;
const sharedCacheTtlSeconds = 600;

export function clearStocksRequestCache(): void {
  requestCache.clear();
}

function readStockData<T>(market: StockMarket | "all", operation: string, parameters: Array<string | number>, loader: (db: Db) => Promise<T>) {
  const codes = market === "tw" ? enabledTaiwanEtfCodes
    : market === "us" ? [...enabledDailyGlobalEtfCodes, ...enabledInstitutionCodes]
      : [...enabledTaiwanEtfCodes, ...enabledDailyGlobalEtfCodes, ...enabledInstitutionCodes];
  const universe = codes.join(".");
  // Keep history reads from this implementation separate during rolling
  // deployments. Previous keys expire through their existing TTL.
  const cacheVersion = operation === "history" ? "v2" : "v1";
  const parts = ["api", "stocks", cacheVersion, market, operation, universe, ...parameters];
  // Cache raw data shared by visitors and members. Identity is verified and
  // previews are projected separately on every request below.
  return getTimedCached(requestCache, JSON.stringify(parts), requestCacheTtlMilliseconds, loader, { sharedCacheKey: parts, sharedCacheTtlSeconds });
}

type StockParamsResult =
  | { error: string }
  | { market: "tw" | "us"; symbol: string; date?: string };

function stockTrendWindows(result: Awaited<ReturnType<typeof stockHistory>>) {
  return ([3, 5, 20] as const).map((window) => {
    const points = result.points.slice(0, window);
    const activeValues = points
      .map((row) => "activeNetLots" in row ? row.activeNetLots : undefined)
      .filter((value): value is number => value !== null && value !== undefined);
    const weightChanges = points
      .map((row) => "weightChangePercentPoints" in row ? row.weightChangePercentPoints : undefined)
      .filter((value): value is number => value !== null && value !== undefined);
    return {
      window,
      cumulative: result.market === "tw"
        ? (activeValues.length ? activeValues.reduce((sum, value) => sum + value, 0) : null)
        : (weightChanges.length ? weightChanges.reduce((sum, value) => sum + value, 0) : null),
      increases: points.filter((row) => row.direction === "increase").length,
      decreases: points.filter((row) => row.direction === "decrease").length,
      observations: result.market === "tw" ? activeValues.length : weightChanges.length,
      coverage: result.coverage?.tracked ? result.coverage.available / result.coverage.tracked : 0
    };
  });
}

function stockParams(request: HttpRequest): StockParamsResult {
  const market = marketSchema.safeParse(request.params.market);
  const rawSymbol = stockSymbolSchema.safeParse(request.params.symbol);
  if (!market.success || !rawSymbol.success) return { error: "market must be tw or us and symbol is required" } as const;
  const symbol = normalizedStockSymbol(market.data, rawSymbol.data);
  if (!symbol) return { error: "symbol format does not match the selected market" } as const;
  const date = optionalDate(request.query.get("date"));
  if (date.error) return { error: date.error };
  return { market: market.data, symbol, date: date.value } as const;
}

export async function getStocksSearch(request: HttpRequest, context: InvocationContext) {
  const query = querySchema.safeParse(request.query.get("q") ?? "");
  const marketValue = request.query.get("market");
  const market = marketValue ? marketSchema.safeParse(marketValue) : null;
  const limit = limitSchema.safeParse(request.query.get("limit") ?? "12");
  if (!query.success) return badRequest("q must contain 2 to 40 characters");
  if (market && !market.success) return badRequest("market must be tw or us");
  if (!limit.success) return badRequest("limit must be between 1 and 50");
  try {
    const timed = await readStockData(market?.data ?? "all", "search", [query.data, limit.data], db => searchStocks(db, query.data, market?.data, limit.data));
    return withServerTiming(cachedJsonResponse(timed.value, 120), timed.metrics);
  } catch (error) {
    context.error("stocks search failed", error);
    return jsonResponse({ error: "stocks search is temporarily unavailable" }, 500);
  }
}

export async function getStockOverview(request: HttpRequest, context: InvocationContext) {
  const params = stockParams(request);
  if ("error" in params) return badRequest(params.error);
  try {
    const timed = await readStockData(params.market, "overview", [params.symbol, params.date ?? "latest"], db => stockOverview(db, params.market, params.symbol, params.date));
    const result = timed.value;
    if (!result.found) return notFound("stock was not found in the tracked data universe");
    const access = await memberRequestAccess(request);
    return withServerTiming(memberJsonResponse({
      ...result,
      overseasEtfExposure: result.overseasEtfExposure
        ? { ...result.overseasEtfExposure, rows: maskMemberResultsByStableKey(result.overseasEtfExposure.rows, access.authenticated, (row) => `${params.market}:${params.symbol}:exposure:${row.etfCode}:${row.assetType}`) }
        : null,
      sec13f: result.sec13f
        ? { ...result.sec13f, rows: maskMemberResultsByStableKey(result.sec13f.rows, access.authenticated, (row) => `${params.market}:${params.symbol}:13f:${row.institutionCode}`) }
        : null
    }), timed.metrics);
  } catch (error) {
    context.error("stock overview failed", error);
    return jsonResponse({ error: "stock overview is temporarily unavailable" }, 500);
  }
}

export async function getStockHistory(request: HttpRequest, context: InvocationContext) {
  const params = stockParams(request);
  if ("error" in params) return badRequest(params.error);
  const window = windowSchema.safeParse(request.query.get("window") ?? "20");
  if (!window.success) return badRequest("window must be 3, 5, or 20 effective trading days");
  try {
    const timed = await readStockData(params.market, "history", [params.symbol, window.data, params.date ?? "latest"], db => stockHistory(db, params.market, params.symbol, window.data, params.date));
    const result = timed.value;
    const access = await memberRequestAccess(request);
    const memberTrendWindows = maskMemberResults(stockTrendWindows(result), access.authenticated, "after-first");
    return withServerTiming(memberJsonResponse(access.authenticated ? { ...result, memberTrendWindows } : {
      ...result,
      points: result.points.slice(0, 3),
      summary: undefined,
      globalSummary: undefined,
      memberTrendWindows
    }), timed.metrics);
  } catch (error) {
    context.error("stock history failed", error);
    return jsonResponse({ error: "stock history is temporarily unavailable" }, 500);
  }
}

export async function getStockEtfs(request: HttpRequest, context: InvocationContext) {
  const params = stockParams(request);
  if ("error" in params) return badRequest(params.error);
  try {
    const timed = await readStockData(params.market, "etfs", [params.symbol, params.date ?? "latest"], db => stockEtfs(db, params.market, params.symbol, params.date));
    const result = timed.value;
    const access = await memberRequestAccess(request);
    const rows = result.rows as Array<(typeof result.rows)[number]>;
    return withServerTiming(memberJsonResponse({
      ...result,
      rows: maskMemberResultsByStableKey(
        rows,
        access.authenticated,
        (row) => `${params.market}:${params.symbol}:etf:${row.etfCode}:${"assetType" in row ? row.assetType : "holding"}`
      )
    }), timed.metrics);
  } catch (error) {
    context.error("stock ETF detail failed", error);
    return jsonResponse({ error: "stock ETF detail is temporarily unavailable" }, 500);
  }
}

export async function getStockInstitutions(request: HttpRequest, context: InvocationContext) {
  const params = stockParams(request);
  if ("error" in params) return badRequest(params.error);
  try {
    const timed = await readStockData(params.market, "institutions", [params.symbol, params.date ?? "latest"], db => stockInstitutions(db, params.market, params.symbol, params.date));
    const result = timed.value;
    const access = await memberRequestAccess(request);
    return withServerTiming(memberJsonResponse({
      ...result,
      rows: result.rows ? maskMemberResultsByStableKey(result.rows, access.authenticated, (row) => `${params.market}:${params.symbol}:institution:${row.institutionCode}`) : undefined
    }), timed.metrics);
  } catch (error) {
    context.error("stock institutions failed", error);
    return jsonResponse({ error: "institution data is temporarily unavailable" }, 500);
  }
}

app.http("getStocksSearch", { methods: ["GET"], route: "stocks/search", authLevel: "anonymous", handler: getStocksSearch });
app.http("getStockOverview", { methods: ["GET"], route: "stocks/{market}/{symbol}/overview", authLevel: "anonymous", handler: getStockOverview });
app.http("getStockHistory", { methods: ["GET"], route: "stocks/{market}/{symbol}/history", authLevel: "anonymous", handler: getStockHistory });
app.http("getStockEtfs", { methods: ["GET"], route: "stocks/{market}/{symbol}/etfs", authLevel: "anonymous", handler: getStockEtfs });
app.http("getStockInstitutions", { methods: ["GET"], route: "stocks/{market}/{symbol}/institutions", authLevel: "anonymous", handler: getStockInstitutions });
