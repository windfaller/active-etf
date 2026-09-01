import type { HttpRequest } from "@azure/functions";
import { verifyFirebaseIdToken, type FirebaseIdTokenClaims } from "./firebaseTokenVerifier.js";

export const MEMBER_SESSION_COOKIE_NAME = "active_etf_session";

export function requestCookies(request: HttpRequest): Record<string, string> {
  const raw = request.headers?.get("cookie") ?? "";
  return Object.fromEntries(raw.split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return [part.trim(), ""];
    const value = part.slice(separator + 1).trim();
    try {
      return [part.slice(0, separator).trim(), decodeURIComponent(value)];
    } catch {
      return [part.slice(0, separator).trim(), ""];
    }
  }).filter(([key]) => Boolean(key)));
}

export function memberSessionToken(request: HttpRequest): string | null {
  return requestCookies(request)[MEMBER_SESSION_COOKIE_NAME] ?? null;
}

export async function verifiedMemberClaims(request: HttpRequest): Promise<FirebaseIdTokenClaims | null> {
  const idToken = memberSessionToken(request);
  if (!idToken) return null;
  try {
    return await verifyFirebaseIdToken(idToken);
  } catch {
    return null;
  }
}

export async function hasVerifiedMemberSession(request: HttpRequest): Promise<boolean> {
  return (await verifiedMemberClaims(request)) !== null;
}
