export const ACTIVE_ETF_COMPARE_COMPLETE_EVENT = "active_etf_compare_complete";
export type AuthAnalyticsEvent =
  | "active_etf_login_intent"
  | "active_etf_login_success"
  | "active_etf_login_failed"
  | "active_etf_logout";

type ComparisonMarket = "tw" | "global";
type AnalyticsEventParams = {
  comparison_market: ComparisonMarket;
  etf_count: number;
  interaction_source: "comparison_results";
};

export interface AnalyticsTarget {
  dataLayer?: unknown[];
}

function browserAnalyticsTarget(): AnalyticsTarget | null {
  return typeof window === "undefined" ? null : window as AnalyticsTarget;
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

    const dataLayer = target.dataLayer ??= [];
    dataLayer.push({
      event: ACTIVE_ETF_COMPARE_COMPLETE_EVENT,
      comparison_market: market,
      etf_count: normalizedCodes.length,
      interaction_source: "comparison_results"
    });
    trackedComparisons.add(comparisonKey);
    return true;
  };
}

export const trackEtfCompareComplete = createEtfComparisonTracker();

export function trackAuthEvent(event: AuthAnalyticsEvent, interactionSource: string): boolean {
  const target = browserAnalyticsTarget();
  if (!target) return false;
  const dataLayer = target.dataLayer ??= [];
  dataLayer.push({
    event,
    auth_method: "external_firebase",
    interaction_source: interactionSource
  });
  return true;
}
