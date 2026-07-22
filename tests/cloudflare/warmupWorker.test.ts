import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Wrangler deploys this Worker directly as JavaScript.
import worker, { healthCheckUrl } from "../../cloudflare/azure-warmup/src/index.js";

const controller = {
  cron: "*/5 * * * *",
  scheduledTime: 1_784_694_000_000
};

const env = {
  WARMUP_URL: "https://active.example/api/health/warmup",
  WARMUP_TOKEN: "secret",
  FORVIX_STAGING_HEALTH_URL: "https://staging.example/api/health",
  FORVIX_PRODUCTION_HEALTH_URL: "https://production.example/api/health"
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shared Cloudflare warmup Worker", () => {
  it("adds the required source and timestamp query parameters", () => {
    expect(healthCheckUrl("https://example.com/api/health", controller.scheduledTime)).toBe(
      `https://example.com/api/health?source=cloudflare-warmup&ts=${controller.scheduledTime}`
    );
  });

  it("warms the protected Active ETF endpoint and both public Forvix endpoints", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await worker.scheduled(controller, env);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith(env.WARMUP_URL, expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-warmup-token": env.WARMUP_TOKEN })
    }));
    expect(fetchMock).toHaveBeenCalledWith(
      `${env.FORVIX_STAGING_HEALTH_URL}?source=cloudflare-warmup&ts=${controller.scheduledTime}`,
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${env.FORVIX_PRODUCTION_HEALTH_URL}?source=cloudflare-warmup&ts=${controller.scheduledTime}`,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("finishes every target before reporting a partial failure", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      new Response(null, { status: String(url).includes("staging") ? 503 : 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(worker.scheduled(controller, env)).rejects.toThrow("forvix-staging");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
