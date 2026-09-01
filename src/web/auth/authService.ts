import { apiBase } from "../apiClient.js";

export const AUTH_APP_BASE = "https://auth-app.gogowinners.me";
export const AUTH_TOKEN_PARAM = "idToken";
export const AUTH_ACTION_PARAM = "authAction";
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
}

export function stripAuthToken(input: string): string {
  const url = new URL(input);
  url.searchParams.delete(AUTH_TOKEN_PARAM);
  url.searchParams.delete(AUTH_ACTION_PARAM);
  return url.toString();
}

export function buildSignInUrl(currentUrl: string, locale = "zh-TW"): string {
  const params = new URLSearchParams({
    redirect: stripAuthToken(currentUrl),
    locale
  });
  return `${AUTH_APP_BASE}/sign-in?${params.toString()}`;
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
};

export interface BrowserAuthCallback {
  idToken: string | null;
  action: AuthAction | null;
}

export function consumeBrowserAuthCallback(): BrowserAuthCallback {
  const target = window as AuthCallbackWindow;
  const idToken = target.__ACTIVE_ETF_AUTH_CALLBACK_TOKEN__ ?? extractAuthToken(window.location.href);
  const action = target.__ACTIVE_ETF_AUTH_CALLBACK_ACTION__ ?? extractAuthAction(window.location.href);
  delete target.__ACTIVE_ETF_AUTH_CALLBACK_TOKEN__;
  delete target.__ACTIVE_ETF_AUTH_CALLBACK_ACTION__;
  if (extractAuthToken(window.location.href) || new URL(window.location.href).searchParams.has(AUTH_ACTION_PARAM)) clearAuthTokenFromBrowserUrl();
  return { idToken, action };
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
