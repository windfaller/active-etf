import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { BoundedRequestCache } from "../services/cache/boundedRequestCache.js";
import { intelligenceSignals } from "../services/intelligence/signalIntelligenceService.js";
import { limitSchema, optionalDate, signalKindSchema, windowSchema } from "./intelligenceValidation.js";
import { badRequest, cachedJsonResponse, jsonResponse } from "./response.js";

const requestCache = new BoundedRequestCache();
const requestCacheTtlMilliseconds = 60_000;

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
    const key = [kind.data, window.data, limit.data, date.value ?? "latest"].join(":");
    const result = await requestCache.getOrLoad(key, requestCacheTtlMilliseconds, async () =>
      intelligenceSignals(await getDb(), kind.data, window.data, limit.data, date.value)
    );
    return cachedJsonResponse(result, 180);
  } catch (error) {
    context.error("signals failed", error);
    return jsonResponse({ error: "signals are temporarily unavailable" }, 500);
  }
}

app.http("getSignals", { methods: ["GET"], route: "signals", authLevel: "anonymous", handler: getSignals });
