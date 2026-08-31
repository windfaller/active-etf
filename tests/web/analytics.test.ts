import { describe, expect, it } from "vitest";
import {
  ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
  createEtfComparisonTracker,
  trackAuthEvent,
  type AnalyticsTarget
} from "../../src/web/analytics.js";

describe("Active ETF analytics", () => {
  it("tracks a completed comparison without sending ETF codes", () => {
    const target: AnalyticsTarget = {};
    const track = createEtfComparisonTracker(() => target);

    expect(track("tw", ["00982A", "00981A"])).toBe(true);
    expect(target.dataLayer).toEqual([{
      event: ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
      comparison_market: "tw",
      etf_count: 2,
      interaction_source: "comparison_results"
    }]);
    expect(JSON.stringify(target.dataLayer)).not.toContain("00981A");
    expect(JSON.stringify(target.dataLayer)).not.toContain("00982A");
  });

  it("deduplicates the same comparison within the current page session", () => {
    const target: AnalyticsTarget = {};
    const track = createEtfComparisonTracker(() => target);

    expect(track("global", ["DRAM", "HBMX"])).toBe(true);
    expect(track("global", ["HBMX", "DRAM"])).toBe(false);
    expect(target.dataLayer).toHaveLength(1);
  });

  it("pushes a GTM custom event object", () => {
    const target: AnalyticsTarget = {};
    const track = createEtfComparisonTracker(() => target);

    expect(track("tw", ["00981A", "00982A", "00983A"])).toBe(true);
    expect(target.dataLayer).toEqual([{
      event: ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
      comparison_market: "tw",
      etf_count: 3,
      interaction_source: "comparison_results"
    }]);
  });

  it("does not track invalid comparison sizes or non-browser execution", () => {
    const target: AnalyticsTarget = {};
    const track = createEtfComparisonTracker(() => target);
    const noBrowserTrack = createEtfComparisonTracker(() => null);

    expect(track("tw", ["00981A"])).toBe(false);
    expect(track("tw", ["1", "2", "3", "4", "5"])).toBe(false);
    expect(noBrowserTrack("tw", ["00981A", "00982A"])).toBe(false);
    expect(target.dataLayer).toBeUndefined();
  });

  it("tracks auth lifecycle without user identifiers or token data", () => {
    const previousWindow = globalThis.window;
    const target: AnalyticsTarget = {};
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      expect(trackAuthEvent("active_etf_login_success", "auth_callback")).toBe(true);
      expect(target.dataLayer).toEqual([{
        event: "active_etf_login_success",
        auth_method: "external_firebase",
        interaction_source: "auth_callback"
      }]);
      expect(JSON.stringify(target.dataLayer)).not.toMatch(/email|uid|token/iu);
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });
});
