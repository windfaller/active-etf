import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
  createEtfComparisonTracker,
  type AnalyticsTarget
} from "../../src/web/analytics.js";

describe("Active ETF analytics", () => {
  it("tracks a completed comparison without sending ETF codes", () => {
    const gtag = vi.fn();
    const target: AnalyticsTarget = { gtag };
    const track = createEtfComparisonTracker(() => target);

    expect(track("tw", ["00982A", "00981A"])).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", ACTIVE_ETF_COMPARE_COMPLETE_EVENT, {
      comparison_market: "tw",
      etf_count: 2,
      interaction_source: "comparison_results"
    });
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("00981A");
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("00982A");
  });

  it("deduplicates the same comparison within the current page session", () => {
    const gtag = vi.fn();
    const track = createEtfComparisonTracker(() => ({ gtag }));

    expect(track("global", ["DRAM", "HBMX"])).toBe(true);
    expect(track("global", ["HBMX", "DRAM"])).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it("queues the event when gtag has not loaded yet", () => {
    const target: AnalyticsTarget = {};
    const track = createEtfComparisonTracker(() => target);

    expect(track("tw", ["00981A", "00982A", "00983A"])).toBe(true);
    expect(target.dataLayer).toEqual([
      [
        "event",
        ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
        {
          comparison_market: "tw",
          etf_count: 3,
          interaction_source: "comparison_results"
        }
      ]
    ]);
  });

  it("does not track invalid comparison sizes or non-browser execution", () => {
    const gtag = vi.fn();
    const track = createEtfComparisonTracker(() => ({ gtag }));
    const noBrowserTrack = createEtfComparisonTracker(() => null);

    expect(track("tw", ["00981A"])).toBe(false);
    expect(track("tw", ["1", "2", "3", "4", "5"])).toBe(false);
    expect(noBrowserTrack("tw", ["00981A", "00982A"])).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });
});
