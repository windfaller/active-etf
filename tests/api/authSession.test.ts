import type { HttpRequest, InvocationContext } from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyFirebaseIdToken: vi.fn() }));
vi.mock("../../src/services/auth/firebaseTokenVerifier.js", () => ({
  verifyFirebaseIdToken: mocks.verifyFirebaseIdToken
}));

import { authSession } from "../../src/api/authSession.js";

function request(method: string, options: { body?: unknown; cookie?: string; secure?: boolean } = {}): HttpRequest {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.secure) headers.set("x-forwarded-proto", "https");
  return new Request("https://active-etf.inthewins.com/api/auth/session", {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }) as unknown as HttpRequest;
}

function context(): InvocationContext {
  return { warn: vi.fn() } as unknown as InvocationContext;
}

describe("/api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyFirebaseIdToken.mockResolvedValue({
      email: "member@example.com",
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3_600,
      name: "ETF Member",
      picture: "https://example.com/avatar.png",
      sub: "firebase-user-1",
      user_id: "firebase-user-1"
    });
  });

  it("creates an HttpOnly same-site session after backend verification", async () => {
    const response = await authSession(request("POST", { body: { idToken: "signed.firebase.token" }, secure: true }), context());
    const headers = new Headers(response.headers);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ authenticated: true, user: { uid: "firebase-user-1", email: "member@example.com" } });
    expect(headers.get("Set-Cookie")).toContain("active_etf_session=");
    expect(headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(headers.get("Set-Cookie")).toContain("SameSite=Lax");
    expect(headers.get("Set-Cookie")).toContain("Secure");
    expect(headers.get("Cache-Control")).toContain("no-store");
  });

  it("reads and clears the session without returning the raw token", async () => {
    const getResponse = await authSession(request("GET", { cookie: "active_etf_session=signed.firebase.token" }), context());
    expect(getResponse.jsonBody).toMatchObject({ authenticated: true, user: { name: "ETF Member" } });
    expect(JSON.stringify(getResponse.jsonBody)).not.toContain("signed.firebase.token");

    const deleteResponse = await authSession(request("DELETE", { cookie: "active_etf_session=signed.firebase.token" }), context());
    expect(deleteResponse.jsonBody).toEqual({ authenticated: false, user: null });
    expect(new Headers(deleteResponse.headers).get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("rejects invalid callbacks and removes invalid stored sessions", async () => {
    mocks.verifyFirebaseIdToken.mockRejectedValue(new Error("bad signature"));
    const postResponse = await authSession(request("POST", { body: { idToken: "bad.token" } }), context());
    expect(postResponse.status).toBe(401);
    expect(JSON.stringify(postResponse.jsonBody)).not.toContain("bad signature");

    const getResponse = await authSession(request("GET", { cookie: "active_etf_session=bad.token" }), context());
    expect(getResponse.status).toBe(200);
    expect(getResponse.jsonBody).toEqual({ authenticated: false, user: null });
    expect(new Headers(getResponse.headers).get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("requires a callback token", async () => {
    const response = await authSession(request("POST", { body: {} }), context());
    expect(response.status).toBe(400);
  });
});
