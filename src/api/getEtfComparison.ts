import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { findGlobalEtfConfig } from "../config/globalEtfs.js";
import { BoundedRequestCache } from "../services/cache/boundedRequestCache.js";
import { compareEtfs } from "../services/intelligence/etfComparisonService.js";
import { comparisonTypeSchema, optionalDate } from "./intelligenceValidation.js";
import { badRequest, cachedJsonResponse, jsonResponse, notFound, withServerTiming } from "./response.js";
import { getTimedCached } from "./timedRequestCache.js";

const requestCache = new BoundedRequestCache();
const requestCacheTtlMilliseconds = 300_000;

export function clearEtfComparisonRequestCache(): void {
  requestCache.clear();
}

export async function getEtfComparison(request: HttpRequest, context: InvocationContext) {
  const type = comparisonTypeSchema.safeParse(request.query.get("type") ?? "tw");
  if (!type.success) return badRequest("type must be tw or global");
  const codes = [...new Set((request.query.get("codes") ?? "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (codes.length < 2 || codes.length > 4) return badRequest("compare between 2 and 4 ETF codes");
  if (codes.some((code) => !/^[A-Z0-9.-]{2,12}$/u.test(code))) return badRequest("ETF code contains unsupported characters");
  const date = optionalDate(request.query.get("date"));
  if (date.error) return badRequest(date.error);
  if (type.data === "tw") {
    const known = new Set(configuredEtfs.filter((row) => row.enabled).map((row) => row.etfCode));
    const unknown = codes.find((code) => !known.has(code));
    if (unknown) return notFound(`unknown Taiwan ETF code: ${unknown}`);
  } else {
    const unknown = codes.find((code) => !findGlobalEtfConfig(code)?.enabled);
    if (unknown) return notFound(`unknown global ETF code: ${unknown}`);
    if (codes.some((code) => findGlobalEtfConfig(code)?.strategyType === "13f")) return badRequest("13F portfolios cannot be compared as ETFs");
  }
  try {
    const key = [type.data, codes.join(","), date.value ?? "latest"].join(":");
    const timed = await getTimedCached(requestCache, key, requestCacheTtlMilliseconds, (db) =>
      compareEtfs(db, type.data, codes, date.value)
    );
    return withServerTiming(cachedJsonResponse(timed.value, 300), timed.metrics);
  } catch (error) {
    context.error("ETF comparison failed", error);
    return jsonResponse({ error: "ETF comparison is temporarily unavailable" }, 500);
  }
}

app.http("getEtfComparison", { methods: ["GET"], route: "compare/etfs", authLevel: "anonymous", handler: getEtfComparison });
