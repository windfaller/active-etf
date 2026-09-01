import {
  grantTrackingConsent,
  pushGoogleCommand,
  trackMetaCustomEvent,
  type ImpliedConsentInteraction,
  type TrackingConsentTarget
} from "./consent.js";

export const ACTIVE_ETF_COMPARE_COMPLETE_EVENT = "active_etf_compare_complete";
export const ACTIVE_ETF_PAGE_CLICK_EVENT = "active_etf_page_click";
export const ACTIVE_ETF_FEATURE_INTERACTION_EVENT = "active_etf_feature_interaction";
export type AuthAnalyticsEvent =
  | "active_etf_login_intent"
  | "active_etf_login_success"
  | "active_etf_sign_up_success"
  | "active_etf_login_failed"
  | "active_etf_logout";

type ComparisonMarket = "tw" | "global";
type AnalyticsEventParams = Record<string, string | number | boolean>;

export interface AnalyticsTarget extends TrackingConsentTarget {
  dataLayer?: unknown[];
}

function browserAnalyticsTarget(): AnalyticsTarget | null {
  return typeof window === "undefined" ? null : window as AnalyticsTarget;
}

function sendAnalyticsEvent(target: AnalyticsTarget, event: string, params: AnalyticsEventParams): boolean {
  pushGoogleCommand(target, "event", event, params);
  trackMetaCustomEvent(event, target);
  return true;
}

export function createEtfComparisonTracker(
  getTarget: () => AnalyticsTarget | null = browserAnalyticsTarget
): (market: ComparisonMarket, codes: string[]) => boolean {
  const trackedComparisons = new Set<string>();

  return (market, codes) => {
    const normalizedCodes = [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))].sort();
    if (normalizedCodes.length < 2 || normalizedCodes.length > 4) return false;

    const target = getTarget();
    if (!target) return false;

    const comparisonKey = `${market}:${normalizedCodes.join(",")}`;
    if (trackedComparisons.has(comparisonKey)) return false;

    sendAnalyticsEvent(target, ACTIVE_ETF_COMPARE_COMPLETE_EVENT, {
      comparison_market: market,
      etf_count: normalizedCodes.length,
      interaction_source: "comparison_results"
    });
    trackedComparisons.add(comparisonKey);
    return true;
  };
}

export const trackEtfCompareComplete = createEtfComparisonTracker();

type PageDestination =
  | "today"
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
  | "other";

export function pageDestination(pathname: string): PageDestination {
  const path = new URL(pathname, "https://active-etf.inthewins.com").pathname.replace(/\/+$/u, "") || "/";
  if (path === "/") return "today";
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
  return "other";
}

export function trackInitialPageView(pathname: string): boolean {
  const target = browserAnalyticsTarget();
  if (!target) return false;
  const destination = pageDestination(pathname);
  return sendAnalyticsEvent(target, "page_view", {
    page_destination: destination,
    page_location: `https://active-etf.inthewins.com/_measurement/${destination}`,
    page_title: `active_etf_${destination}`,
    interaction_source: "initial_page_load"
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
  if (event === "active_etf_login_intent" || event === "active_etf_sign_up_success") {
    grantTrackingConsent(target);
  }
  return sendAnalyticsEvent(target, event, {
    auth_method: "external_firebase",
    interaction_source: interactionSource
  });
}
