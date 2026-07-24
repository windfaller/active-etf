import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { BoundedRequestCache } from "../services/cache/boundedRequestCache.js";
import { intelligenceSignals } from "../services/intelligence/signalIntelligenceService.js";
import { limitSchema, optionalDate, signalKindSchema, windowSchema } from "./intelligenceValidation.js";
import { badRequest, edgeCachedJsonResponse, jsonResponse, withServerTiming } from "./response.js";
import { getTimedCached } from "./timedRequestCache.js";

const requestCache = new BoundedRequestCache();
const requestCacheTtlMilliseconds = 180_000;
const sharedCacheTtlSeconds = 600;

export function clearSignalsRequestCache(): void {
  requestCache.clear();
}

export async function getSignals(request: HttpRequest, context: InvocationContext) {
  const kind = signalKindSchema.safeParse(request.query.get("kind") ?? "all");
  const window = windowSchema.safeParse(request.query.get("window") ?? "20");
  const limit = limitSchema.safeParse(request.query.get("limit") ?? "30");
  const date = optionalDate(request.query.get("date"));
  if (!kind.success) return badRequest("kind must be all, consecutive, reversals, or divergence");
  if (!window.success) return badRequest("window must be 3, 5, or 20 effective trading days");
  if (!limit.success) return badRequest("limit must be between 1 and 50");
  if (date.error) return badRequest(date.error);
  try {
    const key = [window.data, date.value ?? "latest"].join(":");
    const timed = await getTimedCached(
      requestCache,
      key,
      requestCacheTtlMilliseconds,
      (db) => intelligenceSignals(db, "all", window.data, 50, date.value),
      {
        sharedCacheKey: ["api", "signals", "v1", window.data, date.value ?? "latest"],
        sharedCacheTtlSeconds
      }
    );
    const fullResult = timed.value;
    const result = {
      ...fullResult,
      kind: kind.data,
      consecutive: kind.data === "all" || kind.data === "consecutive" ? fullResult.consecutive.slice(0, limit.data) : [],
      reversals: kind.data === "all" || kind.data === "reversals" ? fullResult.reversals.slice(0, limit.data) : [],
      divergences: kind.data === "all" || kind.data === "divergence" ? fullResult.divergences.slice(0, limit.data) : []
    };
    return withServerTiming(edgeCachedJsonResponse(result, 30, 600), timed.metrics);
  } catch (error) {
    context.error("signals failed", error);
    return jsonResponse({ error: "signals are temporarily unavailable" }, 500);
  }
}

app.http("getSignals", { methods: ["GET"], route: "signals", authLevel: "anonymous", handler: getSignals });
