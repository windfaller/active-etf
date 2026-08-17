import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { BoundedRequestCache } from "../services/cache/boundedRequestCache.js";
import { fundPerformanceRankings } from "../services/performance/fundPerformanceService.js";
import { optionalDate } from "./intelligenceValidation.js";
import { badRequest, edgeCachedJsonResponse, jsonResponse, withServerTiming } from "./response.js";
import { getTimedCached } from "./timedRequestCache.js";

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
    return withServerTiming(edgeCachedJsonResponse(timed.value, 300, 1_800), timed.metrics);
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
