import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { globalSearch, type SearchResultType } from "../services/intelligence/searchService.js";
import { limitSchema, querySchema, searchResultTypeSchema } from "./intelligenceValidation.js";
import { badRequest, cachedJsonResponse, jsonResponse } from "./response.js";

export async function getSearch(request: HttpRequest, context: InvocationContext) {
  const query = querySchema.safeParse(request.query.get("q") ?? "");
  const limit = limitSchema.safeParse(request.query.get("limit") ?? "12");
  const rawTypes = (request.query.get("types") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const types: SearchResultType[] = [];
  for (const value of rawTypes) {
    const parsed = searchResultTypeSchema.safeParse(value);
    if (!parsed.success) return badRequest(`unsupported search type: ${value}`);
    types.push(parsed.data);
  }
  if (!query.success) return badRequest("q must contain 2 to 40 characters");
  if (!limit.success) return badRequest("limit must be between 1 and 50");
  try {
    return cachedJsonResponse(await globalSearch(await getDb(), query.data, types, limit.data), 120);
  } catch (error) {
    context.error("global search failed", error);
    return jsonResponse({ error: "search is temporarily unavailable" }, 500);
  }
}

app.http("getSearch", { methods: ["GET"], route: "search", authLevel: "anonymous", handler: getSearch });
