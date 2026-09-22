import { afterEach, beforeEach, describe, it, expect } from "vitest";
import type { Server } from "node:http";
import { AgentStore, hash, secret } from "../../src/mcp/store.js";
import { createAgentApp } from "../../src/mcp/server.js";
import { toolDefinitions } from "../../src/mcp/data.js";
let server: Server, store: AgentStore, origin: string;
beforeEach(async () => {
  store = new AgentStore(":memory:");
  // Bind an ephemeral port before constructing discovery URLs.
  server = (await import("node:http")).createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const app = createAgentApp({
    origin,
    store,
    verifyIdentity: async (token) => {
      if (token !== "valid-fixture") throw Error();
      return { sub: "member-one", exp: Math.floor(Date.now() / 1000) + 3600 };
    },
    provider: async () => ({
      data: { sourceAsOf: "2026-09-21", holdings: [{ stockId: "2330" }] },
      hasData: true,
    }),
  });
  server.on("request", app);
});
afterEach(async () => {
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  store.close();
});
const post = async (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  fetch(origin + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    redirect: "manual",
  });
async function flow() {
  const client = await (
    await post("/oauth/register", {
      client_name: "Test client",
      redirect_uris: ["https://client.example/callback"],
    })
  ).json();
  const verifier = secret(),
    state = secret();
  const query = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: client.redirect_uris[0],
    response_type: "code",
    code_challenge: hash(verifier),
    code_challenge_method: "S256",
    resource: origin + "/mcp",
    state,
  });
  const auth = await fetch(origin + "/oauth/authorize?" + query, {
    redirect: "manual",
  });
  const request = new URL(auth.headers.get("location")!).searchParams.get(
    "request",
  );
  const login = await post(
    "/api/agent/login",
    { returnPath: "/en/mcp/connect?request=" + request },
    { Origin: origin },
  );
  const loginCookie = login.headers.get("set-cookie")!.split(";")[0];
  const loginUrl = new URL((await login.json()).redirect),
    loginState = new URL(
      loginUrl.searchParams.get("redirect")!,
    ).searchParams.get("login_state");
  const session = await post(
    "/api/agent/session",
    { idToken: "valid-fixture", loginState },
    { Origin: origin, Cookie: loginCookie },
  );
  const cookie = session.headers
    .get("set-cookie")!
    .split(/, (?=etf_agent_session=)/)
    .find((x) => x.startsWith("etf_agent_session="))!
    .split(";")[0];
  const csrf = (await session.json()).csrfToken;
  const approve = await post(
    "/api/agent/authorize",
    { request, approve: true },
    { Origin: origin, Cookie: cookie, "X-CSRF-Token": csrf },
  );
  const callback = new URL((await approve.json()).redirect);
  expect(callback.searchParams.get("state")).toBe(state);
  const body = {
    grant_type: "authorization_code",
    client_id: client.client_id,
    resource: origin + "/mcp",
    redirect_uri: client.redirect_uris[0],
    code: callback.searchParams.get("code"),
    code_verifier: verifier,
  };
  return { body, cookie, csrf };
}
describe("OAuth + MCP boundary", () => {
  it("issues expiring installation links without granting MCP or session access", async () => {
    expect((await post("/api/agent/install-link", {locale:"en"}, {Origin:origin})).status).toBe(401);
    const {cookie,csrf} = await flow();
    expect((await post("/api/agent/install-link", {locale:"en"}, {Origin:origin,Cookie:cookie})).status).toBe(403);
    const response = await post("/api/agent/install-link", {locale:"zh-TW"}, {Origin:origin,Cookie:cookie,"X-CSRF-Token":csrf});
    expect(response.status).toBe(200);
    const link = await response.json();
    expect(link.expiresAt - Date.now()).toBeGreaterThan(1790_000);
    const ticket = new URL(link.url).searchParams.get("ticket")!;
    const guide = await fetch(link.url);
    expect(guide.status).toBe(200);
    expect(guide.headers.get("cache-control")).toBe("no-store");
    expect(guide.headers.get("x-robots-tag")).toContain("noindex");
    const body = await guide.text();
    expect(body).toContain("name: active-etf-research");
    expect(body).toContain("codex mcp add active-etf");
    for (const value of [ticket, csrf, cookie.split("=")[1], "member-one"]) expect(body).not.toContain(value);
    expect((await post("/mcp", {}, {Authorization:"Bearer " + ticket})).status).toBe(401);
    expect((await fetch(origin + "/api/agent/skill", {headers:{Cookie:"etf_agent_session="+ticket}})).status).toBe(401);
    expect((await store.usage("member-one")).used).toBe(0);
    await store.put("install_guide", hash(ticket), {locale:"zh-TW"}, -1);
    expect((await fetch(link.url)).status).toBe(404);
    expect((await fetch(origin + "/api/agent/install-guide?ticket=invalid")).status).toBe(404);
  });
  it("serves localized Skill downloads only to active member sessions without spending quota", async () => {
    expect((await fetch(origin + "/api/agent/skill?lang=en")).status).toBe(401);
    const { cookie, csrf } = await flow();
    for (const lang of ["en", "zh-TW", "zh-CN", "ja", "ko"]) {
      const r = await fetch(origin + "/api/agent/skill?lang=" + lang, {headers: {Cookie: cookie}});
      expect(r.status).toBe(200);
      expect(r.headers.get("content-disposition")).toContain('filename="SKILL.md"');
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("x-robots-tag")).toContain("noindex");
      const body = await r.text();
      expect(body).toContain("name: active-etf-research");
      expect(body).toContain("https://active-etf-mcp.inthewins.com/api/mcp");
      expect(body).not.toContain(cookie.split("=")[1]);
    }
    expect((await store.usage("member-one")).used).toBe(0);
    expect((await fetch(origin + "/api/agent/skill?lang=../en", {headers:{Cookie:cookie}})).status).toBe(400);
    await fetch(origin + "/api/agent/session", {method:"DELETE",headers:{Cookie:cookie,Origin:origin,"X-CSRF-Token":csrf}});
    expect((await fetch(origin + "/api/agent/skill?lang=en", {headers:{Cookie:cookie}})).status).toBe(401);
  });
  it("challenges anonymous callers with discoverable OAuth metadata", async () => {
    const r = await post("/mcp", {});
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain(
      "/.well-known/oauth-protected-resource/mcp",
    );
    const d = await (
      await fetch(origin + "/.well-known/oauth-authorization-server")
    ).json();
    expect(d.code_challenge_methods_supported).toEqual(["S256"]);
  });
  it("rejects unsafe redirect registration, origin and missing PKCE", async () => {
    expect(
      (
        await post("/oauth/register", {
          redirect_uris: ["javascript:alert(1)"],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          "/api/agent/login",
          { returnPath: "/en/mcp/connect" },
          { Origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    expect((await fetch(origin + "/oauth/authorize?client_id=x")).status).toBe(
      400,
    );
  });
  it("requires browser login state and never accepts Firebase tokens as MCP access tokens", async () => {
    expect(
      (
        await post(
          "/api/agent/session",
          { idToken: "valid-fixture", loginState: secret() },
          { Origin: origin },
        )
      ).status,
    ).toBe(403);
    expect(
      (await post("/mcp", {}, { Authorization: "Bearer valid-fixture" }))
        .status,
    ).toBe(401);
  });
  it("issues audience-bound tokens, rejects code replay and enforces quota across clients", async () => {
    const { body } = await flow();
    expect(
      (
        await post("/oauth/token", {
          ...body,
          resource: "https://evil.example/mcp",
        })
      ).status,
    ).toBe(400);
    expect(
      (await post("/oauth/token", { ...body, code_verifier: secret() })).status,
    ).toBe(400);
    const tokenResponse = await post("/oauth/token", body);
    expect(tokenResponse.status).toBe(200);
    const token = await tokenResponse.json();
    expect((await post("/oauth/token", body)).status).toBe(400);
    const headers = {
      Authorization: "Bearer " + token.access_token,
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    };
    const init = await post(
      "/mcp",
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      },
      headers,
    );
    expect(init.status).toBe(200);
    const listing = await (
      await post(
        "/mcp",
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        headers,
      )
    ).json();
    expect(listing.result.tools).toHaveLength(7);
    const req = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_etf_snapshot", arguments: { code: "00981A" } },
    };
    expect(
      (await (await post("/mcp", req, headers)).json()).result.isError,
    ).not.toBe(true);
    const cached = await (
      await post("/mcp", { ...req, id: 4 }, headers)
    ).json();
    expect(cached.result.structuredContent.pointsCharged).toBe(0);
    expect(cached.result.structuredContent.cacheHit).toBe(true);
    expect(store.usage("member-one").used).toBe(1);
    const second = await flow();
    const token2 = await (await post("/oauth/token", second.body)).json();
    expect(token2.access_token).not.toBe(token.access_token);
    expect(store.usage("member-one").remaining).toBe(19);
  });
  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const { body } = await flow();
    const first = await (await post("/oauth/token", body)).json();
    const refresh = {
      grant_type: "refresh_token",
      client_id: body.client_id,
      resource: origin + "/mcp",
      refresh_token: first.refresh_token,
    };
    const next = await (await post("/oauth/token", refresh)).json();
    expect(next.refresh_token).not.toBe(first.refresh_token);
    expect((await post("/oauth/token", refresh)).status).toBe(400);
    expect(
      (await post("/mcp", {}, { Authorization: "Bearer " + next.access_token }))
        .status,
    ).toBe(401);
  });
  it("revokes existing connections without resetting quota", async () => {
    const { body, cookie, csrf } = await flow();
    const token = await (await post("/oauth/token", body)).json();
    expect(
      (
        await post(
          "/api/agent/revoke-all",
          {},
          { Origin: origin, Cookie: cookie, "X-CSRF-Token": csrf },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await post(
          "/mcp",
          {},
          { Authorization: "Bearer " + token.access_token },
        )
      ).status,
    ).toBe(401);
  });
  it("validates bounded tool inputs", () => {
    expect(
      toolDefinitions.get_etf_changes.schema.safeParse({
        code: "00981A",
        days: 31,
      }).success,
    ).toBe(false);
    expect(
      toolDefinitions.compare_etfs.schema.safeParse({
        codes: ["00981A", "00981A"],
      }).success,
    ).toBe(false);
    expect(
      toolDefinitions.get_etf_snapshot.schema.safeParse({ code: "NOT_REAL" })
        .success,
    ).toBe(false);
  });
});
