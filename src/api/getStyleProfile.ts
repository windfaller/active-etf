import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { getDb } from "../db/mongo.js";
import { etfStyleProfile } from "../services/intelligence/styleProfileService.js";
import { optionalDate, styleWindowSchema } from "./intelligenceValidation.js";
import { badRequest, cachedJsonResponse, jsonResponse, notFound } from "./response.js";

export async function getStyleProfile(request: HttpRequest, context: InvocationContext) {
  const code = (request.params.etfCode ?? "").trim().toUpperCase();
  if (!/^[0-9A-Z]{4,12}$/u.test(code)) return badRequest("valid ETF code is required");
  if (!configuredEtfs.some((row) => row.enabled && row.etfCode === code)) return notFound("ETF is not in the tracked Taiwan universe");
  const window = styleWindowSchema.safeParse(request.query.get("window") ?? "20");
  const date = optionalDate(request.query.get("date"));
  if (!window.success) return badRequest("window must be 20 or 60 effective trading days");
  if (date.error) return badRequest(date.error);
  try {
    return cachedJsonResponse(await etfStyleProfile(await getDb(), code, window.data, date.value), 300);
  } catch (error) {
    context.error("style profile failed", error);
    return jsonResponse({ error: "style profile is temporarily unavailable" }, 500);
  }
}

app.http("getStyleProfile", { methods: ["GET"], route: "etf/{etfCode}/style", authLevel: "anonymous", handler: getStyleProfile });
