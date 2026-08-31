import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { verifyFirebaseIdToken, type FirebaseIdTokenClaims } from "../services/auth/firebaseTokenVerifier.js";
import { jsonResponse } from "./response.js";

const SESSION_COOKIE_NAME = "active_etf_session";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}

function noStoreHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    ...extra
  };
}

function safeUser(claims: FirebaseIdTokenClaims): AuthenticatedUser {
  return {
    uid: claims.user_id ?? claims.sub ?? "",
    email: typeof claims.email === "string" ? claims.email : "",
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === "string" ? claims.name : "",
    picture: typeof claims.picture === "string" ? claims.picture : ""
  };
}

function parseCookies(request: HttpRequest): Record<string, string> {
  const raw = request.headers.get("cookie") ?? "";
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

function isSecureRequest(request: HttpRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwardedProto === "https" || request.url.startsWith("https://");
}

function sessionCookie(request: HttpRequest, idToken: string, expiresAt: number): string {
  const maxAge = Math.max(0, Math.min(3_600, expiresAt - Math.floor(Date.now() / 1000)));
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(idToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    isSecureRequest(request) ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

function expiredSessionCookie(request: HttpRequest): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    isSecureRequest(request) ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

async function readTokenBody(request: HttpRequest): Promise<string | null> {
  try {
    const body = await request.json() as { idToken?: unknown };
    return typeof body?.idToken === "string" ? body.idToken : null;
  } catch {
    return null;
  }
}

async function establishSession(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const idToken = await readTokenBody(request);
  if (!idToken) return jsonResponse({ error: "idToken is required." }, 400, noStoreHeaders());

  try {
    const claims = await verifyFirebaseIdToken(idToken);
    return jsonResponse({ authenticated: true, user: safeUser(claims) }, 200, noStoreHeaders({
      "Set-Cookie": sessionCookie(request, idToken, claims.exp ?? 0)
    }));
  } catch (error) {
    context.warn("Firebase login callback verification failed.", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: "登入驗證失敗，請重新登入。" }, 401, noStoreHeaders({
      "Set-Cookie": expiredSessionCookie(request)
    }));
  }
}

async function readSession(request: HttpRequest): Promise<HttpResponseInit> {
  const idToken = parseCookies(request)[SESSION_COOKIE_NAME];
  if (!idToken) return jsonResponse({ authenticated: false, user: null }, 200, noStoreHeaders());

  try {
    const claims = await verifyFirebaseIdToken(idToken);
    return jsonResponse({ authenticated: true, user: safeUser(claims) }, 200, noStoreHeaders());
  } catch {
    return jsonResponse({ authenticated: false, user: null }, 200, noStoreHeaders({
      "Set-Cookie": expiredSessionCookie(request)
    }));
  }
}

export async function authSession(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "POST") return establishSession(request, context);
  if (request.method === "DELETE") {
    return jsonResponse({ authenticated: false, user: null }, 200, noStoreHeaders({
      "Set-Cookie": expiredSessionCookie(request)
    }));
  }
  return readSession(request);
}

app.http("authSession", {
  methods: ["GET", "POST", "DELETE"],
  route: "auth/session",
  authLevel: "anonymous",
  handler: authSession
});
