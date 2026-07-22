import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { hasRedisConfiguration, runRedisCommands } from "../services/cache/redisClient.js";
import { jsonResponse, serverError, unauthorized } from "./response.js";

type ServiceStatus = "pending" | "ok" | "error" | "not_configured";

function validateWarmupToken(request: HttpRequest) {
  const expected = process.env.WARMUP_TOKEN;
  if (!expected) return serverError("WARMUP_TOKEN is required");
  if (request.headers.get("x-warmup-token") !== expected) return unauthorized();
  return null;
}

export async function postWarmup(request: HttpRequest, context: InvocationContext) {
  const authError = validateWarmupToken(request);
  if (authError) return authError;

  const startedAt = Date.now();
  const services: { mongodb: ServiceStatus; redis: ServiceStatus } = {
    mongodb: "pending",
    redis: hasRedisConfiguration() ? "pending" : "not_configured"
  };

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    services.mongodb = "ok";

    if (services.redis === "pending") {
      const [result] = await runRedisCommands([["PING"]]);
      if (result !== "PONG") throw new Error("Unexpected Redis PING response");
      services.redis = "ok";
    }

    return jsonResponse({
      ok: true,
      services,
      durationMs: Date.now() - startedAt
    }, 200, {
      "Cache-Control": "no-store, max-age=0"
    });
  } catch (error) {
    if (services.mongodb === "pending") services.mongodb = "error";
    if (services.redis === "pending") services.redis = "error";
    context.error("Warmup failed", error);

    return jsonResponse({
      ok: false,
      services,
      durationMs: Date.now() - startedAt
    }, 503, {
      "Cache-Control": "no-store, max-age=0"
    });
  }
}

app.http("postWarmup", {
  methods: ["POST"],
  route: "health/warmup",
  authLevel: "anonymous",
  handler: postWarmup
});
