import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { jsonResponse } from "./response.js";

export async function getHealth(_request: HttpRequest, context: InvocationContext) {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return jsonResponse({
      ok: true,
      status: "ready",
      service: "active-etf-api",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt
    }, 200, {
      "Cache-Control": "no-store, max-age=0"
    });
  } catch (error) {
    context.error("Health check failed", error);
    return jsonResponse({
      ok: false,
      status: "unavailable",
      service: "active-etf-api",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt
    }, 503, {
      "Cache-Control": "no-store, max-age=0"
    });
  }
}

app.http("getHealth", {
  methods: ["GET"],
  route: "health",
  authLevel: "anonymous",
  handler: getHealth
});
