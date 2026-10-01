export const AUTH_ORIGIN = "https://auth-app.gogowinners.me";
export const isAuthPreviewOrigin = (origin: string): boolean => /^https:\/\/black-desert-0cdbaeb00-\d+\.eastasia\.3\.azurestaticapps\.net$/u.test(origin);
export function authOriginFor(etfOrigin: string): string {
  const qa = process.env.ACTIVE_ETF_AUTH_QA_AUTH_ORIGIN ?? '';
  return etfOrigin !== 'https://active-etf.inthewins.com' && etfOrigin === process.env.ACTIVE_ETF_AUTH_QA_ORIGIN && isAuthPreviewOrigin(qa) ? qa : AUTH_ORIGIN;
}
export function isEtfOrigin(origin: string): boolean {
  return origin === "https://active-etf.inthewins.com" || /^https:\/\/kind-coast-08b07e900(?:-\d+\.eastasia)?\.7\.azurestaticapps\.net$/u.test(origin) || origin === process.env.ACTIVE_ETF_AUTH_QA_ORIGIN;
}
export function safeResearchReturn(input: string, origin: string, trackingAllowed: boolean): string {
  const url = new URL(input);
  if (!isEtfOrigin(origin) || url.origin !== origin || url.username || url.password) throw new Error("invalid_return_origin");
  const allowed = /^\/(?:start|market|performance|signals(?:\/(?:consecutive|reversals|divergence))?|compare\/etfs|etf\/[A-Z0-9]+(?:\/(?:changes|style|premium-history))?|stocks(?:\/(?:tw|us)\/[A-Z0-9.-]+)?|search|global-etfs(?:\/[A-Z0-9]+)?|institutions(?:\/[A-Z0-9]+)?|methodology)?\/?$/u;
  const result = new URL(allowed.test(url.pathname) ? url.pathname : "/", origin);
  for (const [key, value] of url.searchParams) {
    if ((key === "type" && ["tw", "global"].includes(value)) || (key === "metric" && ["overview", "holdings", "sectors", "activity"].includes(value)) || (key === "codes" && /^[A-Z0-9.-]{2,12}(,[A-Z0-9.-]{2,12}){1,3}$/u.test(value))) result.searchParams.set(key, value);
    if (trackingAllowed && ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid", "fbclid"].includes(key) && value.length <= 300 && /^[\w.~-]+$/u.test(value)) result.searchParams.set(key, value);
  }
  return result.toString();
}
