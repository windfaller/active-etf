import { apiBase } from "../apiClient.js";
import { CAMPAIGN_KEYS, safeCampaignValues, withCampaign } from "../attribution.js";
import { readBrowserTrackingConsent } from "../consent.js";

export const AUTH_APP_BASE = "https://auth-app.gogowinners.me";
export const AUTH_TOKEN_PARAM = "idToken";
export const AUTH_ACTION_PARAM = "authAction";
export const AUTH_ACTION_OPT_IN_PARAM = "returnAuthAction";
export type AuthAction = "login" | "sign_up";

export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
  authReceipt?: { loginEventId?: string; registration?: { eventName: string; eventId: string; scope: string } };
}

export function stripAuthToken(input: string): string {
  const url = new URL(input);
  url.searchParams.delete(AUTH_TOKEN_PARAM);
  url.searchParams.delete(AUTH_ACTION_PARAM);
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  return url.toString();
}

export function safeAuthReturnUrl(input: string): string {
  const source = new URL(stripAuthToken(input));
  const localPreview = /^(?:localhost|127\.0\.0\.1)$/u.test(source.hostname);
  const azurePreview = source.protocol === "https:" && /^kind-coast-08b07e900(?:-\d+\.eastasia)?\.7\.azurestaticapps\.net$/u.test(source.hostname);
  if (!localPreview && !azurePreview && source.origin !== "https://active-etf.inthewins.com") throw new Error("Unsupported return origin");
  const allowedPath = /^\/(?:start|market|performance|signals(?:\/(?:consecutive|reversals|divergence))?|compare\/etfs|etf\/[A-Z0-9]+(?:\/(?:changes|style|premium-history))?|stocks(?:\/(?:tw|us)\/[A-Z0-9.-]+)?|search|global-etfs(?:\/[A-Z0-9]+)?|institutions(?:\/[A-Z0-9]+)?|methodology)?\/?$/u;
  const result = new URL(allowedPath.test(source.pathname) ? source.pathname : "/", source.origin);
  const permitted = new Set<string>(["type", "codes", "metric"]);
  for (const [key, value] of source.searchParams) {
    if (!permitted.has(key)) continue;
    if (key === "type" && (value === "tw" || value === "global")) result.searchParams.set(key, value);
    if (key === "codes" && /^[A-Z0-9.-]{3,12}(,[A-Z0-9.-]{3,12}){1,3}$/u.test(value)) result.searchParams.set(key, value);
    if (key === "metric" && ["overview", "holdings", "sectors", "activity"].includes(value)) result.searchParams.set(key, value);
  }
  const canKeepCampaign = typeof window === "undefined" || readBrowserTrackingConsent() === "granted";
  if (canKeepCampaign) {
    for (const [key, value] of Object.entries(safeCampaignValues(source.search))) {
      if ((CAMPAIGN_KEYS as readonly string[]).includes(key)) result.searchParams.set(key, value);
    }
  }
  return (canKeepCampaign ? withCampaign(result) : result).toString();
}

export function buildSignInUrl(currentUrl: string, locale = "zh-TW"): string {
  const params = new URLSearchParams({
    redirect: safeAuthReturnUrl(currentUrl),
    locale,
    [AUTH_ACTION_OPT_IN_PARAM]: "1"
  });
  return `${AUTH_APP_BASE}/sign-in?${params.toString()}`;
}

export async function startBrowserAuth(intent: "login" | "sign_up"): Promise<void> {
  const response = await fetch(`${apiBase}/api/auth/start`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, returnUrl: safeAuthReturnUrl(window.location.href), trackingAllowed: readBrowserTrackingConsent() === "granted" })
  });
  const data = await response.json() as { authUrl?: string };
  if (!response.ok || !data.authUrl) throw new Error("帳號服務暫時無法開啟，請稍後再試。");
  const target = new URL(data.authUrl);
  if (target.origin !== AUTH_APP_BASE || target.pathname !== (intent === "sign_up" ? "/register" : "/sign-in") || target.searchParams.get("returnMode") !== "post") throw new Error("帳號返回設定無效。");
  window.location.assign(target.toString());
}

export function extractAuthToken(input: string): string | null {
  return new URL(input).searchParams.get(AUTH_TOKEN_PARAM);
}

export function extractAuthAction(input: string): AuthAction | null {
  const value = new URL(input).searchParams.get(AUTH_ACTION_PARAM);
  return value === "login" || value === "sign_up" ? value : null;
}

type AuthCallbackWindow = Window & {
  __ACTIVE_ETF_AUTH_CALLBACK_TOKEN__?: string;
  __ACTIVE_ETF_AUTH_CALLBACK_ACTION__?: AuthAction;
  __ACTIVE_ETF_AUTH_CALLBACK_ERROR__?: string;
};

export interface BrowserAuthCallback {
  idToken: string | null;
  action: AuthAction | null;
  error: "cancelled" | "failed" | null;
}

export function consumeBrowserAuthCallback(): BrowserAuthCallback {
  const target = window as AuthCallbackWindow;
  const idToken = target.__ACTIVE_ETF_AUTH_CALLBACK_TOKEN__ ?? extractAuthToken(window.location.href);
  const action = target.__ACTIVE_ETF_AUTH_CALLBACK_ACTION__ ?? extractAuthAction(window.location.href);
  const rawError = target.__ACTIVE_ETF_AUTH_CALLBACK_ERROR__ ?? new URL(window.location.href).searchParams.get("error");
  const error = rawError === "access_denied" || rawError === "cancelled" ? "cancelled" : rawError ? "failed" : null;
  delete target.__ACTIVE_ETF_AUTH_CALLBACK_TOKEN__;
  delete target.__ACTIVE_ETF_AUTH_CALLBACK_ACTION__;
  delete target.__ACTIVE_ETF_AUTH_CALLBACK_ERROR__;
  if (extractAuthToken(window.location.href) || new URL(window.location.href).searchParams.has(AUTH_ACTION_PARAM) || rawError) clearAuthTokenFromBrowserUrl();
  return { idToken, action, error };
}

export function consumeBrowserAuthToken(): string | null {
  return consumeBrowserAuthCallback().idToken;
}

export function clearAuthTokenFromBrowserUrl(): void {
  window.history.replaceState({}, document.title, stripAuthToken(window.location.href));
}

async function sessionRequest(init: RequestInit = {}): Promise<AuthSessionResponse> {
  const response = await fetch(`${apiBase}/api/auth/session`, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      'x-active-etf-tracking-consent': readBrowserTrackingConsent() ?? 'unknown',
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });
  const payload = await response.json().catch(() => null) as (AuthSessionResponse & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? "登入驗證失敗，請重新登入。");
  return payload ?? { authenticated: false, user: null };
}

export function getAuthSession(): Promise<AuthSessionResponse> {
  return sessionRequest();
}

export function establishAuthSession(idToken: string): Promise<AuthSessionResponse> {
  return sessionRequest({ method: "POST", body: JSON.stringify({ idToken }) });
}

export function clearAuthSession(): Promise<AuthSessionResponse> {
  return sessionRequest({ method: "DELETE" });
}
