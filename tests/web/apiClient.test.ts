import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearJsonCache, getJson, readCachedJson } from "../../src/web/apiClient.js";

beforeEach(() => {
  clearJsonCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("web API memory cache", () => {
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
