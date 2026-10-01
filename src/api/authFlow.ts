import { app, type Cookie, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { randomBytes, randomUUID } from "node:crypto";
import { authFlowStore, fingerprint, type AuthFlow } from "../services/auth/flowStore.js";
import { AUTH_ORIGIN, isEtfOrigin, safeResearchReturn } from "../services/auth/returnPolicy.js";
import { isNewAccountDuringFlow, lookupFirebaseCreation } from "../services/auth/firebaseAccount.js";
import { verifyFirebaseIdToken } from "../services/auth/firebaseTokenVerifier.js";
import { requestCookies } from "../services/auth/memberSession.js";
import { sessionCookie } from "./authSession.js";
import { jsonResponse } from "./response.js";
import { supportsEtfPostReturn } from "../services/auth/authCapability.js";

export const FLOW_COOKIE = "active_etf_auth_binding";
export const RECEIPT_COOKIE = "active_etf_auth_receipt";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const uuid = /^[a-f\d-]{36}$/u;
function cookie(request: HttpRequest, name: string, value: string, maxAge: number, crossSite = false): Cookie {
  const secure = request.url.startsWith("https://") || request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';
  return { name, value, path: "/", httpOnly: true, secure, sameSite: crossSite ? "None" : "Lax", maxAge };
}
export async function startAuthFlow(request: HttpRequest): Promise<HttpResponseInit> {
  if (process.env.ACTIVE_ETF_AUTH_STARTS_DISABLED === 'true') return jsonResponse({ error: 'auth_starts_disabled' }, 503, headers);
  const origin = request.headers.get("origin") ?? "";
  if (!isEtfOrigin(origin)) return jsonResponse({ error: "unsupported_origin" }, 403, headers);
  try {
    const body = await request.json() as { returnUrl?: string; intent?: string; trackingAllowed?: boolean };
    if (typeof body.returnUrl !== "string" || body.returnUrl.length > 2200 || !["login", "sign_up"].includes(body.intent ?? "")) return jsonResponse({ error: "invalid_request" }, 400, headers);
    const trackingAllowed = body.trackingAllowed === true;
    const returnUrl = safeResearchReturn(body.returnUrl, origin, trackingAllowed);
    if (!await supportsEtfPostReturn()) return jsonResponse({ error: "auth_post_flow_not_ready" }, 503, headers);
    const binding = randomBytes(32).toString("base64url");
    const cookies = requestCookies(request);
    const metaUserData: AuthFlow["metaUserData"] = {};
    if (trackingAllowed) for (const [key, name] of [["fbp", "_fbp"], ["fbc", "_fbc"]] as const) {
      if (/^fb\.\d\.\d{10,13}\.[\w.-]{1,300}$/u.test(cookies[name] ?? "")) metaUserData[key] = cookies[name];
    }
    const flow: AuthFlow = { _id: randomUUID(), binding: fingerprint(binding), returnUrl, createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60_000), status: "pending", trackingAllowed, metaUserData };
    await authFlowStore.create(flow);
    const authUrl = new URL(body.intent === "sign_up" ? "/register" : "/sign-in", AUTH_ORIGIN);
    authUrl.search = new URLSearchParams({ redirect: returnUrl, locale: "zh-TW", returnAuthAction: "1", returnMode: "post", authFlow: flow._id }).toString();
    return { ...jsonResponse({ authUrl: authUrl.toString() }, 200, headers), cookies: [cookie(request, FLOW_COOKIE, binding, 86400, true)] };
  } catch { return jsonResponse({ error: "auth_start_unavailable" }, 503, headers); }
}
export async function finishAuthFlow(request: HttpRequest): Promise<HttpResponseInit> {
  const allowedAuthOrigin = request.headers.get("origin") === AUTH_ORIGIN || (process.env.ACTIVE_ETF_AUTH_QA_AUTH_ORIGIN && request.headers.get("origin") === process.env.ACTIVE_ETF_AUTH_QA_AUTH_ORIGIN);
  if (!allowedAuthOrigin || !request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return jsonResponse({ error: "unsupported_callback" }, 403, headers);
  const raw = await request.text();
  if (raw.length > 15000) return jsonResponse({ error: "invalid_callback" }, 400, headers);
  const body = new URLSearchParams(raw);
  const expiredReturn = () => {
    let url = new URL('/start', 'https://active-etf.inthewins.com');
    try { const candidate = new URL(body.get('returnUrl') ?? ''); url = new URL(safeResearchReturn(candidate.toString(), candidate.origin, false)); } catch { /* safe default */ }
    url.searchParams.set('error', 'failed');
    return { status: 303, headers: { ...headers, Location: url.toString() }, cookies: [] };
  };
  const id = body.get("state") ?? "";
  const binding = requestCookies(request)[FLOW_COOKIE] ?? "";
  if (!uuid.test(id) || !binding) return expiredReturn();
  let existing: AuthFlow | null;
  try { existing = await authFlowStore.get(id); } catch { return expiredReturn(); }
  if (!existing || existing.binding !== fingerprint(binding) || !isEtfOrigin(new URL(existing.returnUrl).origin)) return expiredReturn();
  const redirect = (url: string, cookies: Cookie[] = []) => ({ status: 303, headers: { ...headers, Location: url }, cookies });
  if (existing.status !== "pending") return redirect(existing.returnUrl); // Replay never establishes a session or creates another event.
  let flow: AuthFlow | null;
  try { flow = await authFlowStore.claim(id, fingerprint(binding)); } catch { return expiredReturn(); }
  if (!flow) return redirect(existing.returnUrl);
  const fail = async (kind: "failed" | "cancelled") => {
    await authFlowStore.finish(id, { status: kind }).catch(() => undefined);
    const target = new URL(flow.returnUrl); target.searchParams.set("error", kind);
    return redirect(target.toString());
  };
  if (body.get("error")) return fail(body.get("error") === "cancelled" ? "cancelled" : "failed");
  const idToken = body.get("idToken") ?? "";
  try {
    const claims = await verifyFirebaseIdToken(idToken);
    const subject = fingerprint(`${claims.aud}:${claims.sub}`);
    const createdAt = await lookupFirebaseCreation(idToken, claims).catch(() => null);
    const registrationEventId = flow.trackingAllowed && isNewAccountDuringFlow(createdAt, flow.createdAt.getTime(), Date.now()) ? await authFlowStore.register(subject, flow, createdAt!).catch(() => undefined) : undefined;
    await authFlowStore.finish(id, { status: "complete", subject, loginEventId: randomUUID(), ...(registrationEventId ? { registrationEventId } : {}) });
    return redirect(flow.returnUrl, [sessionCookie(request, idToken, claims.exp ?? 0), cookie(request, RECEIPT_COOKIE, id, 600)]);
  } catch { return fail("failed"); }
}
app.http("startAuthFlow", { methods: ["POST"], route: "auth/start", authLevel: "anonymous", handler: startAuthFlow });
app.http("finishAuthFlow", { methods: ["POST"], route: "auth/callback", authLevel: "anonymous", handler: finishAuthFlow });
