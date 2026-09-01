import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { maskMemberResults, maskMemberResultsByStableKey } from "../domain/memberAccess.js";
import { getDb } from "../db/mongo.js";
import { stockEtfs, stockHistory, stockInstitutions, stockOverview, searchStocks } from "../services/intelligence/stockIntelligenceService.js";
import { badRequest, cachedJsonResponse, jsonResponse, notFound } from "./response.js";
import { limitSchema, marketSchema, normalizedStockSymbol, optionalDate, querySchema, stockSymbolSchema, windowSchema } from "./intelligenceValidation.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";

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
    return cachedJsonResponse(await searchStocks(await getDb(), query.data, market?.data, limit.data), 120);
  } catch (error) {
    context.error("stocks search failed", error);
    return jsonResponse({ error: "stocks search is temporarily unavailable" }, 500);
  }
}

export async function getStockOverview(request: HttpRequest, context: InvocationContext) {
  const params = stockParams(request);
  if ("error" in params) return badRequest(params.error);
  try {
    const result = await stockOverview(await getDb(), params.market, params.symbol, params.date);
    if (!result.found) return notFound("stock was not found in the tracked data universe");
    const access = await memberRequestAccess(request);
    return memberJsonResponse({
      ...result,
      overseasEtfExposure: result.overseasEtfExposure
        ? { ...result.overseasEtfExposure, rows: maskMemberResultsByStableKey(result.overseasEtfExposure.rows, access.authenticated, (row) => `${params.market}:${params.symbol}:exposure:${row.etfCode}:${row.assetType}`) }
        : null,
      sec13f: result.sec13f
        ? { ...result.sec13f, rows: maskMemberResultsByStableKey(result.sec13f.rows, access.authenticated, (row) => `${params.market}:${params.symbol}:13f:${row.institutionCode}`) }
        : null
    });
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
    const result = await stockHistory(await getDb(), params.market, params.symbol, window.data, params.date);
    const access = await memberRequestAccess(request);
    const memberTrendWindows = maskMemberResults(stockTrendWindows(result), access.authenticated, "after-first");
    return memberJsonResponse(access.authenticated ? { ...result, memberTrendWindows } : {
      ...result,
      points: result.points.slice(0, 3),
      summary: undefined,
      globalSummary: undefined,
      memberTrendWindows
    });
  } catch (error) {
    context.error("stock history failed", error);
    return jsonResponse({ error: "stock history is temporarily unavailable" }, 500);
  }
}

export async function getStockEtfs(request: HttpRequest, context: InvocationContext) {
  const params = stockParams(request);
  if ("error" in params) return badRequest(params.error);
  try {
    const result = await stockEtfs(await getDb(), params.market, params.symbol, params.date);
    const access = await memberRequestAccess(request);
    const rows = result.rows as Array<(typeof result.rows)[number]>;
    return memberJsonResponse({
      ...result,
      rows: maskMemberResultsByStableKey(
        rows,
        access.authenticated,
        (row) => `${params.market}:${params.symbol}:etf:${row.etfCode}:${"assetType" in row ? row.assetType : "holding"}`
      )
    });
  } catch (error) {
    context.error("stock ETF detail failed", error);
    return jsonResponse({ error: "stock ETF detail is temporarily unavailable" }, 500);
  }
}

export async function getStockInstitutions(request: HttpRequest, context: InvocationContext) {
  const params = stockParams(request);
  if ("error" in params) return badRequest(params.error);
  try {
    const result = await stockInstitutions(await getDb(), params.market, params.symbol, params.date);
    const access = await memberRequestAccess(request);
    return memberJsonResponse({
      ...result,
      rows: result.rows ? maskMemberResultsByStableKey(result.rows, access.authenticated, (row) => `${params.market}:${params.symbol}:institution:${row.institutionCode}`) : undefined
    });
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
