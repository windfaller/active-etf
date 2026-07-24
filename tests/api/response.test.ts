import { describe, expect, it } from "vitest";
import { edgeCachedJsonResponse, withServerTiming } from "../../src/api/response.js";

describe("API response performance headers", () => {
  it("separates browser and edge cache lifetimes", () => {
    const response = edgeCachedJsonResponse({ ok: true }, 30, 180);
    expect(new Headers(response.headers).get("Cache-Control")).toBe(
      "public, max-age=30, s-maxage=180, stale-while-revalidate=360"
    );
  });

  it("serializes bounded Server-Timing metrics without invalid descriptions", () => {
    const response = withServerTiming(edgeCachedJsonResponse({ ok: true }), [
      { name: "total", duration: 12.34 },
      { name: "app cache", description: "hit\"unsafe" }
    ]);
    expect(new Headers(response.headers).get("Server-Timing")).toBe(
      "total;dur=12.3, app-cache;desc=\"hitunsafe\""
    );
  });
});
