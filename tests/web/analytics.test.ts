import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
  ACTIVE_ETF_FEATURE_INTERACTION_EVENT,
  ACTIVE_ETF_PAGE_CLICK_EVENT,
  createEtfComparisonTracker,
  pageDestination,
  trackAuthEvent,
  trackFeatureInteraction,
  trackInitialPageView,
  trackPageClick,
  type AnalyticsTarget
} from "../../src/web/analytics.js";

function commands(target: AnalyticsTarget): unknown[][] {
  return (target.dataLayer ?? []).map((entry) => Array.from(entry as IArguments));
}

function eventCommand(target: AnalyticsTarget, event: string): unknown[] | undefined {
  return commands(target).find((command) => command[0] === "event" && command[1] === event);
}

describe("Active ETF analytics", () => {
  it("tracks a completed comparison without sending ETF codes", () => {
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: true };
    const track = createEtfComparisonTracker(() => target);

    expect(track("tw", ["00982A", "00981A"])).toBe(true);
    expect(eventCommand(target, ACTIVE_ETF_COMPARE_COMPLETE_EVENT)).toEqual([
      "event",
      ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
      { comparison_market: "tw", etf_count: 2, interaction_source: "comparison_results" }
    ]);
    expect(JSON.stringify(commands(target))).not.toMatch(/00981A|00982A/u);
  });

  it("deduplicates the same comparison within the current page session", () => {
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: true };
    const track = createEtfComparisonTracker(() => target);

    expect(track("global", ["DRAM", "HBMX"])).toBe(true);
    expect(track("global", ["HBMX", "DRAM"])).toBe(false);
    expect(commands(target).filter((command) => command[1] === ACTIVE_ETF_COMPARE_COMPLETE_EVENT)).toHaveLength(1);
  });

  it("keeps anonymous Google events before full consent and does not call Meta", () => {
    const fbq = vi.fn();
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: false, fbq };
    const track = createEtfComparisonTracker(() => target);

    expect(track("tw", ["00981A", "00982A"])).toBe(true);
    expect(eventCommand(target, ACTIVE_ETF_COMPARE_COMPLETE_EVENT)).toBeDefined();
    expect(fbq).not.toHaveBeenCalled();
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
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: true };
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      expect(trackAuthEvent("active_etf_login_success", "auth_callback")).toBe(true);
      expect(eventCommand(target, "active_etf_login_success")).toEqual([
        "event",
        "active_etf_login_success",
        { auth_method: "external_firebase", interaction_source: "auth_callback" }
      ]);
      expect(JSON.stringify(commands(target))).not.toMatch(/email|uid|token/iu);
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });

  it("tracks sanitized initial and internal page destinations without instrument identifiers", () => {
    const previousWindow = globalThis.window;
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: false };
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      expect(trackInitialPageView("/etf/00981A?from=ad")).toBe(true);
      expect(trackPageClick("/stocks/tw/2330?from=market")).toBe(true);
      expect(eventCommand(target, "page_view")?.[2]).toEqual({
        page_destination: "tw_etf",
        page_location: "https://active-etf.inthewins.com/_measurement/tw_etf",
        page_title: "active_etf_tw_etf",
        interaction_source: "initial_page_load"
      });
      expect(eventCommand(target, ACTIVE_ETF_PAGE_CLICK_EVENT)?.[2]).toEqual({
        page_destination: "tw_stock",
        interaction_source: "internal_navigation"
      });
      expect(JSON.stringify(commands(target))).not.toMatch(/00981A|2330|from=ad|from=market/u);
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });

  it("classifies page destinations without exposing instrument identifiers", () => {
    expect(pageDestination("/")).toBe("today");
    expect(pageDestination("/compare/etfs?codes=00981A,00982A")).toBe("etf_compare");
    expect(pageDestination("/global-etfs/DRAM")).toBe("global_etf");
    expect(pageDestination("/institutions/BRK")).toBe("institution");
    expect(pageDestination("/privacy")).toBe("privacy");
    expect(pageDestination("/terms")).toBe("terms");
  });

  it("treats sign-up and feature actions as consented, sanitized events", () => {
    const previousWindow = globalThis.window;
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: false };
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      expect(trackAuthEvent("active_etf_sign_up_success", "auth_callback")).toBe(true);
      expect(target.__ACTIVE_ETF_TRACKING_ALLOWED__).toBe(true);
      expect(eventCommand(target, "active_etf_sign_up_success")?.[2]).toEqual({
        auth_method: "external_firebase",
        interaction_source: "auth_callback"
      });
      expect(trackFeatureInteraction("button")).toBe(true);
      expect(eventCommand(target, ACTIVE_ETF_FEATURE_INTERACTION_EVENT)?.[2]).toEqual({
        interaction_kind: "button",
        interaction_source: "consent_upgrade"
      });
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });
});
