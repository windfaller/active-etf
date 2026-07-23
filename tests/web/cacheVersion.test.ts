import { describe, expect, it } from "vitest";
import { buildVersionedReloadUrl, shouldReloadForVersion } from "../../src/web/cacheVersion.js";

describe("cache version reload URL", () => {
  it("adds the deployed app version to clean app routes", () => {
    expect(buildVersionedReloadUrl("https://active-etf.inthewins.com/market", "abc123")).toBe(
      "https://active-etf.inthewins.com/market?appVersion=abc123"
    );
  });

  it("preserves existing query params and replaces stale version params", () => {
    expect(buildVersionedReloadUrl("https://active-etf.inthewins.com/etf/00981A?date=2026-07-03&appVersion=old#changes", "new-sha")).toBe(
      "https://active-etf.inthewins.com/etf/00981A?date=2026-07-03&appVersion=new-sha#changes"
    );
  });

  it("reloads a stale running bundle even on a visitor without stored version state", () => {
    expect(shouldReloadForVersion("old-build", "new-build", null)).toBe(true);
  });

  it("does not loop while the same replacement version is pending", () => {
    expect(shouldReloadForVersion("old-build", "new-build", "new-build")).toBe(false);
    expect(shouldReloadForVersion("new-build", "new-build", null)).toBe(false);
  });
});
