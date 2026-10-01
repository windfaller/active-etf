import {
  pushGoogleCommand,
  trackMetaCustomEvent,
  type ImpliedConsentInteraction,
  type TrackingConsentTarget
} from "./consent.js";
import { safeCampaignValues } from "./attribution.js";

export const ACTIVE_ETF_COMPARE_COMPLETE_EVENT = "active_etf_compare_complete";
export const ACTIVE_ETF_COMPARE_STARTED_EVENT = "active_etf_compare_started";
export const ACTIVE_ETF_PAGE_CLICK_EVENT = "active_etf_page_click";
export const ACTIVE_ETF_FEATURE_INTERACTION_EVENT = "active_etf_feature_interaction";
export const ACTIVE_ETF_SKILL_INSTALL_PROMPT_COPIED_EVENT = "active_etf_skill_install_prompt_copied";
export const ACTIVE_ETF_SKILL_DOWNLOAD_STARTED_EVENT = "active_etf_skill_download_started";
export type AuthAnalyticsEvent =
  | "active_etf_login_intent"
  | "active_etf_sign_up_started"
  | "active_etf_login_success"
  | "active_etf_login_failed"
  | "active_etf_logout";

type ComparisonMarket = "tw" | "global";
type AnalyticsEventParams = Record<string, string | number | boolean>;

export interface AnalyticsTarget extends TrackingConsentTarget {
  dataLayer?: unknown[];
  sessionStorage?: Pick<Storage, "getItem" | "setItem">;
}

function browserAnalyticsTarget(): AnalyticsTarget | null {
  return typeof window === "undefined" ? null : window as AnalyticsTarget;
}

function sendAnalyticsEvent(target: AnalyticsTarget, event: string, params: AnalyticsEventParams, suppliedId?: string): boolean {
  const eventId = suppliedId ?? globalThis.crypto.randomUUID();
  pushGoogleCommand(target, "event", event, { ...params, event_id: eventId });
  if (event !== ACTIVE_ETF_PAGE_CLICK_EVENT && event !== ACTIVE_ETF_FEATURE_INTERACTION_EVENT) {
    trackMetaCustomEvent(event, target, eventId);
  }
  return true;
}

export type ComparisonSource = "start_primary" | "comparison_builder" | "direct_url" | "refresh";
export interface ComparisonRequest {
  compareId: string;
  market: ComparisonMarket;
  count: number;
  source: ComparisonSource;
  key: string;
  at: number;
  complete: boolean;
}

/** Research choices stay in session state; analytics receives only the request ID and count. */
export function createComparisonRequests(getTarget: () => AnalyticsTarget | null = browserAnalyticsTarget) {
  const storageKey = "active_etf_comparison_request_v2";
  let active: ComparisonRequest | null = null;
  const keyOf = (market: ComparisonMarket, codes: string[]) => `${market}:${[...new Set(codes)].sort().join(",")}`;
  const save = (request: ComparisonRequest) => {
    active = request;
    try { getTarget()?.sessionStorage?.setItem(storageKey, JSON.stringify(request)); } catch { /* private browsing */ }
  };
  const params = (request: ComparisonRequest) => ({ comparison_market: request.market, etf_count: request.count, interaction_source: request.source, compare_id: request.compareId });
  function begin(market: ComparisonMarket, codes: string[], source: ComparisonSource): ComparisonRequest | null {
    const count = new Set(codes).size;
    const target = getTarget();
    if (!target || count < 2 || count > 4) return null;
    const request: ComparisonRequest = { compareId: globalThis.crypto.randomUUID(), market, count, source, key: keyOf(market, codes), at: Date.now(), complete: false };
    save(request);
    sendAnalyticsEvent(target, ACTIVE_ETF_COMPARE_STARTED_EVENT, params(request), `${request.compareId}:started`);
    return request;
  }
  function resume(market: ComparisonMarket, codes: string[]): ComparisonRequest | null {
    try {
      const stored = getTarget()?.sessionStorage?.getItem(storageKey);
      if (stored) active = JSON.parse(stored) as ComparisonRequest;
    } catch { /* private browsing */ }
    if (active?.key === keyOf(market, codes) && active.market === market && active.count === new Set(codes).size
      && ["start_primary", "comparison_builder", "direct_url", "refresh"].includes(active.source)
      && typeof active.complete === "boolean" && Number.isFinite(active.at) && active.at <= Date.now()
      && Date.now() - active.at < 30 * 60_000 && /^[a-f\d-]{36}$/u.test(active.compareId)) return active;
    return begin(market, codes, "direct_url");
  }
  function complete(request: ComparisonRequest | null): boolean {
    const target = getTarget();
    if (!request || request.complete || !target) return false;
    request.complete = true;
    save(request);
    return sendAnalyticsEvent(target, ACTIVE_ETF_COMPARE_COMPLETE_EVENT, params(request), `${request.compareId}:complete`);
  }
  return { begin, resume, complete };
}
export const comparisonRequests = createComparisonRequests();

export function trackPreviewLoaded(): boolean {
  const target = browserAnalyticsTarget();
  return target ? sendAnalyticsEvent(target, "active_etf_preview_loaded", { interaction_source: "start_preview" }) : false;
}

export function trackVerifiedRegistration(receipt: { eventName: string; eventId: string; scope: string }): boolean {
  const target = browserAnalyticsTarget();
  if (!target?.__ACTIVE_ETF_TRACKING_ALLOWED__ || receipt.eventName !== "active_etf_sign_up_success" || receipt.scope !== "shared_account_created" || !/^[a-f\d-]{36}$/u.test(receipt.eventId)) return false;
  const key = `active_etf_registration:${receipt.eventId}`;
  try { if (target.sessionStorage?.getItem(key)) return false; } catch { /* server also claims once */ }
  const sent = sendAnalyticsEvent(target, receipt.eventName, { registration_scope: receipt.scope, interaction_source: "verified_auth_receipt" }, receipt.eventId);
  try { target.sessionStorage?.setItem(key, "1"); } catch { /* server also claims once */ }
  return sent;
}

type PageDestination =
  | "today"
  | "start"
  | "tw_market"
  | "tw_etf"
  | "global_market"
  | "global_etf"
  | "institutions"
  | "institution"
  | "stocks"
  | "tw_stock"
  | "us_stock"
  | "etf_compare"
  | "performance"
  | "signals"
  | "search"
  | "methodology"
  | "privacy"
  | "terms"
  | "mcp_overview"
  | "mcp_skill"
  | "mcp_connect"
  | "other";

export function pageDestination(pathname: string): PageDestination {
  const path = new URL(pathname, "https://active-etf.inthewins.com").pathname.replace(/\/+$/u, "") || "/";
  if (path === "/") return "today";
  if (path === "/start") return "start";
  if (path === "/market") return "tw_market";
  if (/^\/etf\/[^/]+/u.test(path)) return "tw_etf";
  if (path === "/global-etfs") return "global_market";
  if (/^\/global-etfs\/[^/]+/u.test(path)) return "global_etf";
  if (path === "/institutions") return "institutions";
  if (/^\/institutions\/[^/]+/u.test(path)) return "institution";
  if (path === "/stocks") return "stocks";
  if (/^\/stocks\/tw\/[^/]+/u.test(path)) return "tw_stock";
  if (/^\/stocks\/us\/[^/]+/u.test(path)) return "us_stock";
  if (path === "/compare/etfs") return "etf_compare";
  if (path === "/performance") return "performance";
  if (path === "/signals" || path.startsWith("/signals/")) return "signals";
  if (path === "/search") return "search";
  if (path === "/methodology") return "methodology";
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  if (/^\/(?:en|zh-TW|zh-CN|ja|ko)\/mcp\/skill$/u.test(path)) return "mcp_skill";
  if (/^\/(?:en|zh-TW|zh-CN|ja|ko)\/mcp\/connect$/u.test(path)) return "mcp_connect";
  if (/^\/(?:en|zh-TW|zh-CN|ja|ko)\/mcp$/u.test(path)) return "mcp_overview";
  return "other";
}

export function safeAgentPageLocation(input: string): string {
  const url = new URL(input);
  const safe = new URL(url.pathname, "https://active-etf-mcp.inthewins.com");
  for (const [name, value] of Object.entries(safeCampaignValues(url.search))) if (name !== "fbclid") safe.searchParams.set(name, value);
  return safe.toString();
}

export function trackAgentPortalPageView(input: string = window.location.href): boolean {
  const target = browserAnalyticsTarget();
  if (!target) return false;
  const destination = pageDestination(new URL(input).pathname);
  if (!destination.startsWith("mcp_")) return false;
  return sendAnalyticsEvent(target, "page_view", {
    page_destination: destination,
    page_location: safeAgentPageLocation(input),
    page_title: `active_etf_${destination}`,
    interaction_source: "initial_page_load"
  });
}

export function trackAgentAction(
  event: typeof ACTIVE_ETF_SKILL_INSTALL_PROMPT_COPIED_EVENT | typeof ACTIVE_ETF_SKILL_DOWNLOAD_STARTED_EVENT,
  source: "quick_install" | "skill_guide"
): boolean {
  const target = browserAnalyticsTarget();
  return target ? sendAnalyticsEvent(target, event, { interaction_source: source }) : false;
}

export function trackInitialPageView(pathname: string, source: "initial_page_load" | "spa_navigation" = "initial_page_load"): boolean {
  const target = browserAnalyticsTarget();
  if (!target) return false;
  const destination = pageDestination(pathname);
  const campaign = source === "initial_page_load" && typeof window !== "undefined" ? safeCampaignValues(window.location?.search ?? "") : {};
  const location = new URL(`https://active-etf.inthewins.com/_measurement/${destination}`);
  for (const [key, value] of Object.entries(campaign)) if (key !== "fbclid") location.searchParams.set(key, value);
  return sendAnalyticsEvent(target, "page_view", {
    page_destination: destination,
    page_location: location.toString(),
    page_title: `active_etf_${destination}`,
    interaction_source: source
  });
}

export function trackPageClick(pathname: string): boolean {
  const target = browserAnalyticsTarget();
  if (!target) return false;
  return sendAnalyticsEvent(target, ACTIVE_ETF_PAGE_CLICK_EVENT, {
    page_destination: pageDestination(pathname),
    interaction_source: "internal_navigation"
  });
}

export function trackFeatureInteraction(interaction: ImpliedConsentInteraction): boolean {
  const target = browserAnalyticsTarget();
  if (!target) return false;
  return sendAnalyticsEvent(target, ACTIVE_ETF_FEATURE_INTERACTION_EVENT, {
    interaction_kind: interaction,
    interaction_source: "consent_upgrade"
  });
}

export function trackAuthEvent(event: AuthAnalyticsEvent, interactionSource: string): boolean {
  const target = browserAnalyticsTarget();
  if (!target) return false;
  return sendAnalyticsEvent(target, event, {
    auth_method: "external_firebase",
    interaction_source: interactionSource
  });
}
