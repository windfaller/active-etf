import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { BoundedRequestCache } from "../services/cache/boundedRequestCache.js";
import { intelligenceSignals } from "../services/intelligence/signalIntelligenceService.js";
import { limitSchema, optionalDate, signalKindSchema, windowSchema } from "./intelligenceValidation.js";
import { badRequest, cachedJsonResponse, jsonResponse } from "./response.js";

const requestCache = new BoundedRequestCache();
const requestCacheTtlMilliseconds = 180_000;

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
    const fullResult = await requestCache.getOrLoad(key, requestCacheTtlMilliseconds, async () =>
      intelligenceSignals(await getDb(), "all", window.data, 50, date.value)
    );
    const result = {
      ...fullResult,
      kind: kind.data,
      consecutive: kind.data === "all" || kind.data === "consecutive" ? fullResult.consecutive.slice(0, limit.data) : [],
      reversals: kind.data === "all" || kind.data === "reversals" ? fullResult.reversals.slice(0, limit.data) : [],
      divergences: kind.data === "all" || kind.data === "divergence" ? fullResult.divergences.slice(0, limit.data) : []
    };
    return cachedJsonResponse(result, 180);
  } catch (error) {
    context.error("signals failed", error);
    return jsonResponse({ error: "signals are temporarily unavailable" }, 500);
  }
}

app.http("getSignals", { methods: ["GET"], route: "signals", authLevel: "anonymous", handler: getSignals });
