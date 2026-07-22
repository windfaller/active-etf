import type { HttpRequest, InvocationContext } from "@azure/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  command: vi.fn(async () => ({ ok: 1 })),
  getDb: vi.fn(),
  hasRedisConfiguration: vi.fn(() => true),
  runRedisCommands: vi.fn(async () => ["PONG"])
}));

mocks.getDb.mockImplementation(async () => ({ command: mocks.command }));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/cache/redisClient.js", () => ({
  hasRedisConfiguration: mocks.hasRedisConfiguration,
  runRedisCommands: mocks.runRedisCommands
}));

import { postWarmup } from "../../src/api/postWarmup.js";

const originalWarmupToken = process.env.WARMUP_TOKEN;

function request(token?: string): HttpRequest {
  return {
    headers: new Headers(token ? { "x-warmup-token": token } : {})
  } as unknown as HttpRequest;
}

function context(): InvocationContext {
  return { error: vi.fn() } as unknown as InvocationContext;
}

describe("POST /api/health/warmup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WARMUP_TOKEN = "expected-secret";
    mocks.hasRedisConfiguration.mockReturnValue(true);
    mocks.runRedisCommands.mockResolvedValue(["PONG"]);
    mocks.command.mockResolvedValue({ ok: 1 });
  });

  afterEach(() => {
    if (originalWarmupToken === undefined) delete process.env.WARMUP_TOKEN;
    else process.env.WARMUP_TOKEN = originalWarmupToken;
  });

  it("rejects an unconfigured or invalid token before opening dependencies", async () => {
    delete process.env.WARMUP_TOKEN;
    expect((await postWarmup(request(), context())).status).toBe(500);
    process.env.WARMUP_TOKEN = "expected-secret";
    expect((await postWarmup(request("wrong-secret"), context())).status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.runRedisCommands).not.toHaveBeenCalled();
  });

  it("warms MongoDB and Redis without changing application data", async () => {
    const response = await postWarmup(request("expected-secret"), context());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      ok: true,
      services: { mongodb: "ok", redis: "ok" }
    });
    expect(mocks.command).toHaveBeenCalledWith({ ping: 1 });
    expect(mocks.runRedisCommands).toHaveBeenCalledWith([["PING"]]);
  });

  it("keeps working when Redis is intentionally not configured", async () => {
    mocks.hasRedisConfiguration.mockReturnValue(false);

    const response = await postWarmup(request("expected-secret"), context());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      ok: true,
      services: { mongodb: "ok", redis: "not_configured" }
    });
    expect(mocks.runRedisCommands).not.toHaveBeenCalled();
  });

  it("returns a non-sensitive service failure response", async () => {
    mocks.runRedisCommands.mockRejectedValueOnce(new Error("private upstream detail"));
    const invocationContext = context();

    const response = await postWarmup(request("expected-secret"), invocationContext);

    expect(response.status).toBe(503);
    expect(response.jsonBody).toMatchObject({
      ok: false,
      services: { mongodb: "ok", redis: "error" }
    });
    expect(response.jsonBody).not.toHaveProperty("error");
    expect(invocationContext.error).toHaveBeenCalled();
  });
});
