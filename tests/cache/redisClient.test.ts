import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = {
    isOpen: true,
    on: vi.fn(),
    connect: vi.fn(async () => {}),
    sendCommand: vi.fn(async (_command: string[], _options: unknown): Promise<string | number | null> => "OK"),
    ref: vi.fn(),
    unref: vi.fn(),
    destroy: vi.fn()
  };
  return { client, createClient: vi.fn(() => client) };
});
vi.mock("@redis/client", () => ({ createClient: mocks.createClient }));
import { closeRedis, isRedisConfigured, redisGet, redisSetEx, runRedisCommands } from "../../src/services/cache/redisClient.js";

describe("persistent Redis client", () => {
  beforeEach(() => {
    closeRedis();
    vi.clearAllMocks();
    vi.stubEnv("REDIS_GOGOWINNERS_HOST", "cache.example.test");
    vi.stubEnv("REDIS_GOGOWINNERS_KEY", "test-only");
    mocks.client.connect.mockResolvedValue(undefined);
    mocks.client.sendCommand.mockResolvedValue("OK");
  });
  afterEach(() => { closeRedis(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it("authenticates once and reuses a connection for concurrent reads and writes", async () => {
    await Promise.all([redisGet("a"), redisGet("b"), redisSetEx("c", 10, "value")]);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.client.connect).toHaveBeenCalledTimes(1);
    expect(mocks.client.sendCommand).toHaveBeenCalledTimes(3);
    expect(mocks.client.destroy).not.toHaveBeenCalled();
    expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({ disableOfflineQueue: true, socket: expect.objectContaining({ tls: true, reconnectStrategy: false }) }));
  });

  it("retires a failed socket and observes cooldown instead of queuing commands indefinitely", async () => {
    mocks.client.sendCommand.mockRejectedValueOnce(new Error("timeout"));
    await expect(redisGet("a")).rejects.toThrow("timeout");
    expect(isRedisConfigured()).toBe(false);
    await expect(redisGet("b")).rejects.toThrow("temporarily disabled");
    expect(mocks.client.sendCommand).toHaveBeenCalledTimes(1);
    expect(mocks.client.destroy).toHaveBeenCalledTimes(1);
  });

  it("can reconnect after recovery and preserves command timeouts", async () => {
    mocks.client.connect.mockRejectedValueOnce(new Error("connection failed"));
    await expect(runRedisCommands([["PING"]])).rejects.toThrow("connection failed");
    closeRedis();
    expect(await runRedisCommands([["PING"]])).toEqual(["OK"]);
    expect(mocks.client.connect).toHaveBeenCalledTimes(2);
    expect(mocks.client.sendCommand).toHaveBeenCalledWith(["PING"], { timeout: 800 });
  });

  it("reconnects automatically on the first request after cooldown expires", async () => {
    vi.useFakeTimers();
    mocks.client.sendCommand.mockRejectedValueOnce(new Error("connection lost"));
    await expect(redisGet("a")).rejects.toThrow("connection lost");
    expect(isRedisConfigured()).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(isRedisConfigured()).toBe(true);
    await redisGet("b");
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(mocks.client.connect).toHaveBeenCalledTimes(2);
  });

  it("bounds a stalled connection handshake and enters cooldown", async () => {
    vi.useFakeTimers();
    vi.stubEnv("REDIS_COMMAND_TIMEOUT_MS", "100");
    mocks.client.connect.mockImplementationOnce(() => new Promise(() => {}));
    const failedRequest = expect(redisGet("a")).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(101);
    await failedRequest;
    expect(isRedisConfigured()).toBe(false);
    expect(mocks.client.sendCommand).not.toHaveBeenCalled();
  });
});
