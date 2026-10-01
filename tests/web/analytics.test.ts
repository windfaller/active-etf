import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
  ACTIVE_ETF_FEATURE_INTERACTION_EVENT,
  ACTIVE_ETF_PAGE_CLICK_EVENT,
  ACTIVE_ETF_SKILL_INSTALL_PROMPT_COPIED_EVENT,
  createComparisonRequests,
  trackVerifiedRegistration,
  pageDestination,
  safeAgentPageLocation,
  trackAgentAction,
  trackAgentPortalPageView,
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
  it('keeps research usable in browsers without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    try {
      const target: AnalyticsTarget = {};
      const requests = createComparisonRequests(() => target);
      const request = requests.begin('tw', ['00981A', '00982A'], 'direct_url');
      expect(request?.compareId).toMatch(/^[a-f\d-]{36}$/u);
      expect(requests.complete(request)).toBe(true);
      expect(requests.begin('tw', ['00981A', '00982A'], 'comparison_builder')?.compareId).not.toBe(request?.compareId);
    } finally { vi.unstubAllGlobals(); }
  });
  it("tracks a completed comparison without sending ETF codes", () => {
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: true };
    const tracker = createComparisonRequests(() => target);
    const request = tracker.begin("tw", ["00982A", "00981A"], "comparison_builder");
    expect(tracker.complete(request)).toBe(true);
    expect(eventCommand(target, ACTIVE_ETF_COMPARE_COMPLETE_EVENT)).toMatchObject([
      "event",
      ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
      { comparison_market: "tw", etf_count: 2, interaction_source: "comparison_builder", compare_id: request?.compareId, event_id: `${request?.compareId}:complete` }
    ]);
    expect(JSON.stringify(commands(target))).not.toMatch(/00981A|00982A/u);
  });

  it("deduplicates the same comparison within the current page session", () => {
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: true };
    const tracker = createComparisonRequests(() => target);
    const request = tracker.begin("global", ["DRAM", "HBMX"], "start_primary");
    expect(tracker.complete(request)).toBe(true);
    expect(tracker.complete(request)).toBe(false);
    expect(commands(target).filter((command) => command[1] === ACTIVE_ETF_COMPARE_COMPLETE_EVENT)).toHaveLength(1);
  });

  it("preserves the request ID on reload and gives an explicit repeat a new ID", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const target: AnalyticsTarget = { sessionStorage: storage };
    const tracker = createComparisonRequests(() => target);
    const request = tracker.resume("tw", ["00981A", "00982A"]);
    expect(request?.source).toBe("direct_url");
    expect(tracker.complete(request)).toBe(true);
    const reloaded = createComparisonRequests(() => target);
    const same = reloaded.resume("tw", ["00982A", "00981A"]);
    expect(same?.compareId).toBe(request?.compareId);
    expect(reloaded.complete(same)).toBe(false);
    const repeated = reloaded.begin("tw", ["00981A", "00982A"], "comparison_builder");
    expect(repeated?.compareId).not.toBe(request?.compareId);
    expect(reloaded.complete(repeated)).toBe(true);
    const starts = commands(target).filter(command => command[1] === "active_etf_compare_started");
    const completes = commands(target).filter(command => command[1] === ACTIVE_ETF_COMPARE_COMPLETE_EVENT);
    expect(starts).toHaveLength(2); expect(completes).toHaveLength(2);
    expect((starts[0]?.[2] as { compare_id: string }).compare_id).toBe((completes[0]?.[2] as { compare_id: string }).compare_id);
  });

  it("keeps anonymous Google events before full consent and does not call Meta", () => {
    const fbq = vi.fn();
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: false, fbq };
    const tracker = createComparisonRequests(() => target);
    expect(tracker.complete(tracker.begin("tw", ["00981A", "00982A"], "direct_url"))).toBe(true);
    expect(eventCommand(target, ACTIVE_ETF_COMPARE_COMPLETE_EVENT)).toBeDefined();
    expect(fbq).not.toHaveBeenCalled();
  });

  it("does not track invalid comparison sizes or non-browser execution", () => {
    const target: AnalyticsTarget = {};
    const tracker = createComparisonRequests(() => target);
    expect(tracker.begin("tw", ["00981A"], "direct_url")).toBeNull();
    expect(tracker.begin("tw", ["1", "2", "3", "4", "5"], "direct_url")).toBeNull();
    expect(createComparisonRequests(() => null).begin("tw", ["00981A", "00982A"], "direct_url")).toBeNull();
    expect(target.dataLayer).toBeUndefined();
  });

  it("tracks auth lifecycle without user identifiers or token data", () => {
    const previousWindow = globalThis.window;
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: true };
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      expect(trackAuthEvent("active_etf_login_success", "auth_callback")).toBe(true);
      expect(eventCommand(target, "active_etf_login_success")).toMatchObject([
        "event",
        "active_etf_login_success",
        { auth_method: "external_firebase", interaction_source: "auth_callback", event_id: expect.any(String) }
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
      expect(eventCommand(target, "page_view")?.[2]).toMatchObject({
        page_destination: "tw_etf",
        page_location: "https://active-etf.inthewins.com/_measurement/tw_etf",
        page_title: "active_etf_tw_etf",
        interaction_source: "initial_page_load"
      });
      expect(eventCommand(target, ACTIVE_ETF_PAGE_CLICK_EVENT)?.[2]).toMatchObject({
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
    expect(pageDestination("/zh-TW/mcp/skill")).toBe("mcp_skill");
    expect(pageDestination("/en/mcp/connect?request=secret")).toBe("mcp_connect");
  });

  it("keeps ordinary page clicks out of Meta and excludes invented revenue", () => {
    const previousWindow = globalThis.window;
    const fbq = vi.fn();
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: true, fbq };
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      expect(trackPageClick("/compare/etfs?codes=00981A,00982A")).toBe(true);
      const params = eventCommand(target, ACTIVE_ETF_PAGE_CLICK_EVENT)?.[2] as Record<string, unknown>;
      expect(params).not.toHaveProperty("value");
      expect(params).not.toHaveProperty("currency");
      expect(fbq).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });

  it("attributes Agent Skill visits while excluding OAuth credentials and request tickets", () => {
    const previousWindow = globalThis.window;
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: false };
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      const landing = "https://active-etf-mcp.inthewins.com/zh-TW/mcp/skill?utm_source=google&utm_medium=paid&utm_campaign=active_etf_agent_skill_202609&gclid=ad-click&request=secret&idToken=credential";
      expect(trackAgentPortalPageView(landing)).toBe(true);
      expect(eventCommand(target, "page_view")?.[2]).toMatchObject({
        page_destination: "mcp_skill",
        page_location: safeAgentPageLocation(landing),
        page_title: "active_etf_mcp_skill",
        interaction_source: "initial_page_load"
      });
      expect(safeAgentPageLocation(landing)).toContain("utm_campaign=active_etf_agent_skill_202609");
      expect(safeAgentPageLocation(landing)).toContain("gclid=ad-click");
      expect(JSON.stringify(commands(target))).not.toMatch(/secret|credential|idToken|request=/u);
      expect(trackAgentAction(ACTIVE_ETF_SKILL_INSTALL_PROMPT_COPIED_EVENT, "quick_install")).toBe(true);
      expect(eventCommand(target, ACTIVE_ETF_SKILL_INSTALL_PROMPT_COPIED_EVENT)?.[2]).toMatchObject({ interaction_source: "quick_install" });
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });

  it("does not upgrade consent for sign-up events and uses one ID for GA4 and Pixel after consent", () => {
    const previousWindow = globalThis.window;
    const fbq = vi.fn();
    const target: AnalyticsTarget = { __ACTIVE_ETF_TRACKING_ALLOWED__: false, fbq };
    Object.defineProperty(globalThis, "window", { configurable: true, value: target });
    try {
      const receipt = { eventName: "active_etf_sign_up_success", eventId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", scope: "shared_account_created" };
      expect(trackVerifiedRegistration(receipt)).toBe(false);
      expect(target.__ACTIVE_ETF_TRACKING_ALLOWED__).toBe(false);
      expect(eventCommand(target, "active_etf_sign_up_success")).toBeUndefined();
      expect(fbq).not.toHaveBeenCalled();
      target.__ACTIVE_ETF_TRACKING_ALLOWED__ = true;
      const values = new Map<string, string>();
      target.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
      expect(trackVerifiedRegistration(receipt)).toBe(true);
      expect(trackVerifiedRegistration(receipt)).toBe(false);
      const signupCommands = commands(target).filter((command) => command[1] === "active_etf_sign_up_success");
      expect(signupCommands).toHaveLength(1);
      expect(fbq).toHaveBeenCalledWith("trackCustom", "active_etf_sign_up_success", {}, { eventID: receipt.eventId });
      expect(trackFeatureInteraction("button")).toBe(true);
      expect(eventCommand(target, ACTIVE_ETF_FEATURE_INTERACTION_EVENT)?.[2]).toMatchObject({
        interaction_kind: "button",
        interaction_source: "consent_upgrade"
      });
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });
});
