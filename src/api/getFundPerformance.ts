import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { BoundedRequestCache } from "../services/cache/boundedRequestCache.js";
import { maskMemberResultsByStableKey } from "../domain/memberAccess.js";
import { fundPerformanceRankings } from "../services/performance/fundPerformanceService.js";
import { optionalDate } from "./intelligenceValidation.js";
import { badRequest, jsonResponse, withServerTiming } from "./response.js";
import { getTimedCached } from "./timedRequestCache.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";

const requestCache = new BoundedRequestCache();
const requestCacheTtlMilliseconds = 900_000;

export function clearFundPerformanceRequestCache(): void {
  requestCache.clear();
}

export async function getFundPerformance(request: HttpRequest, context: InvocationContext) {
  const date = optionalDate(request.query.get("date"));
  if (date.error) return badRequest(date.error);
  try {
    const key = date.value ?? "latest";
    const timed = await getTimedCached(
      requestCache,
      key,
      requestCacheTtlMilliseconds,
      (db) => fundPerformanceRankings(db, date.value),
      {
        sharedCacheKey: ["api", "fund-performance", "v1", key],
        sharedCacheTtlSeconds: 3_600
      }
    );
    const access = await memberRequestAccess(request);
    return withServerTiming(memberJsonResponse({
      ...timed.value,
      sections: {
        tw: { ...timed.value.sections.tw, rows: maskMemberResultsByStableKey(timed.value.sections.tw.rows, access.authenticated, (row) => `tw:${row.etfCode}`) },
        global: { ...timed.value.sections.global, rows: maskMemberResultsByStableKey(timed.value.sections.global.rows, access.authenticated, (row) => `global:${row.etfCode}`) }
      }
    }), timed.metrics);
  } catch (error) {
    context.error("Fund performance ranking failed", error);
    return jsonResponse({ error: "fund performance ranking is temporarily unavailable" }, 500);
  }
}

app.http("getFundPerformance", {
  methods: ["GET"],
  route: "funds/performance",
  authLevel: "anonymous",
  handler: getFundPerformance
});
