import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearJsonCache, getJson, JSON_FRESH_MS, JSON_MAX_AGE_MS, readCachedJson, waitForJsonSession } from "../../src/web/apiClient.js";

beforeEach(() => {
  clearJsonCache();
  waitForJsonSession(Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("web API memory cache", () => {
  it("reuses fresh data, revalidates stale data and expires the display fallback", async () => {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ value: now })));
    vi.stubGlobal("fetch", fetcher);
    await getJson("/api/cache-lifetime");
    await getJson("/api/cache-lifetime");
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += JSON_FRESH_MS + 1;
    expect(readCachedJson("/api/cache-lifetime")).toEqual({ value: 1000 });
    await getJson("/api/cache-lifetime");
    expect(fetcher).toHaveBeenCalledTimes(2);
    now += JSON_MAX_AGE_MS + 1;
    expect(readCachedJson("/api/cache-lifetime")).toBeNull();
  });

  it("does not refill the cache with an in-flight response from a previous identity", async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
    const request = getJson("/api/member-data");
    await Promise.resolve();
    clearJsonCache();
    complete(new Response(JSON.stringify({ oldIdentity: true })));
    await request;
    expect(readCachedJson("/api/member-data")).toBeNull();
  });

  it("waits for one-time token exchange before requesting member data", async () => {
    let complete!: () => void;
    waitForJsonSession(new Promise<void>((resolve) => { complete = resolve; }));
    const fetcher = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    const request = getJson("/api/after-callback");
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
    complete();
    await request;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("stores successful JSON responses for stale-while-revalidate rendering", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ sourceAsOf: "2026-07-23" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    ));

    await expect(getJson<{ sourceAsOf: string }>("/api/signals?kind=all")).resolves.toEqual({
      sourceAsOf: "2026-07-23"
    });
    expect(readCachedJson<{ sourceAsOf: string }>("/api/signals?kind=all")).toEqual({
      sourceAsOf: "2026-07-23"
    });
  });

  it("does not cache failed responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "temporarily unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      })
    ));

    await expect(getJson("/api/signals?kind=all")).rejects.toThrow("temporarily unavailable");
    expect(readCachedJson("/api/signals?kind=all")).toBeNull();
  });

  it("can invalidate one cached request without clearing the rest", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) =>
      new Response(JSON.stringify({ path: String(input) }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    ));

    await getJson("/api/one");
    await getJson("/api/two");
    clearJsonCache("/api/one");

    expect(readCachedJson("/api/one")).toBeNull();
    expect(readCachedJson<{ path: string }>("/api/two")?.path).toMatch(/\/api\/two$/u);
  });
});
