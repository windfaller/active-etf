import { z } from "zod";
import { AgentError, hash, secret, type AgentStorage } from "./core.js";
import type { FirebaseIdTokenClaims } from "../services/auth/firebaseTokenVerifier.js";
export const SCOPE = "active_etf:read";
interface Grant {
  member: string;
  client: string;
  issued: number;
  family: string;
  resource: string;
}
interface Code extends Grant {
  redirect: string;
  challenge: string;
}
interface Client {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
}
export interface AuthOptions {
  origin: string;
  store: AgentStorage;
  apiPrefix?: string;
  verifyIdentity: (token: string) => Promise<FirebaseIdTokenClaims>;
  allowedMembers?: Set<string>;
}
export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(new Headers(headers)),
    },
  });
const seconds = () => Math.floor(Date.now() / 1000);
const cookie = (req: Request, name: string) =>
  (req.headers.get("cookie") ?? "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1) ?? "";
const redirectUri = (value: string) => {
  const u = new URL(value);
  return (
    !u.hash &&
    !u.username &&
    !u.password &&
    (u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)))
  );
};
export async function requestBody(req: Request) {
  const text = await req.text();
  if (Buffer.byteLength(text) > 32768)
    throw new AgentError("request_too_large", 413);
  try {
    return req.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(text))
      : JSON.parse(text || "{}");
  } catch {
    throw new AgentError("invalid_request");
  }
}
export function createAuth(options: AuthOptions) {
  const { origin, store } = options,
    prefix = options.apiPrefix ?? "",
    resource = origin + prefix + "/mcp";
  const protectedMetadata =
    origin + prefix + "/.well-known/oauth-protected-resource/mcp";
  const assertOrigin = (req: Request) => {
    if (req.headers.get("origin") !== origin)
      throw new AgentError("invalid_origin", 403);
  };
  const identity = (req: Request) =>
    store.get<{ member: string; csrf: string }>(
      "session",
      hash(cookie(req, "etf_agent_session")),
    );
  const csrf = async (req: Request) => {
    assertOrigin(req);
    const s = await identity(req);
    if (!s) throw new AgentError("sign_in_required", 401);
    if (req.headers.get("x-csrf-token") !== s.csrf)
      throw new AgentError("invalid_csrf", 403);
    return s;
  };
  const validGrant = async (g: Grant | null) => {
    if (
      !g ||
      g.resource !== resource ||
      (await store.get("revoked_family", g.family))
    )
      return false;
    const revoked = await store.get<{ at: number }>("revocation", g.member);
    return (
      !(revoked && g.issued <= revoked.at) &&
      (!options.allowedMembers || options.allowedMembers.has(g.member))
    );
  };
  const issue = async (g: Grant) => {
    const access_token = secret(),
      refresh_token = secret();
    await store.put("access", hash(access_token), g, 3600_000);
    await store.put("refresh", hash(refresh_token), g, 30 * 86400_000);
    return {
      access_token,
      refresh_token,
      token_type: "Bearer",
      expires_in: 3600,
      scope: SCOPE,
    };
  };
  const setCookie = (name: string, value: string, maxAge: number) =>
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin.startsWith("https:") ? "; Secure" : ""}`;
  const authorization = async (query: unknown) => {
    const p = z
      .object({
        client_id: z.string().max(500),
        redirect_uri: z.string().url(),
        response_type: z.literal("code"),
        code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        code_challenge_method: z.literal("S256"),
        state: z.string().max(2048).optional(),
        scope: z.literal(SCOPE).default(SCOPE),
        resource: z.literal(resource),
      })
      .parse(query);
    const client = await store.get<Client>("client", p.client_id);
    if (!client || !client.redirect_uris.includes(p.redirect_uri))
      throw new AgentError("invalid_client_or_redirect");
    return { p, client };
  };
  const serverMetadata = {
    issuer: origin,
    authorization_endpoint: origin + prefix + "/oauth/authorize",
    token_endpoint: origin + prefix + "/oauth/token",
    registration_endpoint: origin + prefix + "/oauth/register",
    revocation_endpoint: origin + prefix + "/oauth/revoke",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
  };
  return {
    resource,
    protectedMetadata,
    serverMetadata,
    async authenticate(req: Request) {
      const token = req.headers
          .get("authorization")
          ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1],
        grant = token ? await store.get<Grant>("access", hash(token)) : null;
      if (!(await validGrant(grant)))
        throw new AgentError("invalid_token", 401);
      return grant!.member;
    },
    async handle(req: Request, ip = "unknown"): Promise<Response | null> {
      const url = new URL(req.url),
        path = url.pathname,
        method = req.method;
      if (
        method === "GET" &&
        [
          prefix + "/.well-known/oauth-protected-resource",
          prefix + "/.well-known/oauth-protected-resource/mcp",
        ].includes(path)
      )
        return json({
          resource,
          authorization_servers: [origin],
          scopes_supported: [SCOPE],
          bearer_methods_supported: ["header"],
        });
      if (
        method === "GET" &&
        path === prefix + "/.well-known/oauth-authorization-server"
      )
        return json(serverMetadata);
      if (method === "POST" && path === prefix + "/oauth/register") {
        await store.rate("register:" + ip, 10, 3600_000);
        const input = z
          .object({
            client_name: z.string().max(100).default("MCP client"),
            redirect_uris: z
              .array(z.string().max(2048).url().refine(redirectUri))
              .min(1)
              .max(10),
            token_endpoint_auth_method: z.literal("none").default("none"),
          })
          .parse(await requestBody(req));
        const client: Client = { ...input, client_id: secret() };
        await store.put("client", client.client_id, client, 365 * 86400_000);
        return json(
          {
            ...client,
            client_id_issued_at: seconds(),
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
          },
          201,
        );
      }
      if (method === "GET" && path === prefix + "/oauth/authorize") {
        const { p } = await authorization(Object.fromEntries(url.searchParams)),
          ticket = secret();
        await store.put("authorization", hash(ticket), p, 600_000);
        return new Response(null, {
          status: 302,
          headers: { Location: `${origin}/en/mcp/connect?request=${ticket}` },
        });
      }
      if (method === "GET" && path === "/api/agent/authorization") {
        const ticket = z
            .string()
            .max(100)
            .parse(url.searchParams.get("request")),
          p = await store.get<Record<string, string>>(
            "authorization",
            hash(ticket),
          );
        if (!p) throw new AgentError("authorization_expired");
        const { client } = await authorization(p);
        return json({
          clientName: client.client_name,
          redirectOrigin: new URL(p.redirect_uri).origin,
          scope: SCOPE,
        });
      }
      if (method === "POST" && path === "/api/agent/login") {
        assertOrigin(req);
        await store.rate("login-start:" + ip, 15);
        const { returnPath } = z
          .object({
            returnPath: z
              .string()
              .max(500)
              .regex(
                /^\/(en|zh-TW|zh-CN|ja|ko)\/mcp\/connect(?:\?request=[A-Za-z0-9_-]{43})?$/,
              ),
          })
          .parse(await requestBody(req));
        const nonce = secret();
        await store.put("login", hash(nonce), true, 600_000);
        const callback = new URL(returnPath, origin);
        callback.searchParams.set("login_state", nonce);
        const dest = new URL("https://auth-app.gogowinners.me/sign-in");
        dest.searchParams.set("redirect", callback.toString());
        dest.searchParams.set("locale", returnPath.split("/")[1]);
        return json({ redirect: dest.toString() }, 200, {
          "Set-Cookie": setCookie("etf_agent_login", nonce, 600),
        });
      }
      if (method === "POST" && path === "/api/agent/session") {
        assertOrigin(req);
        await store.rate("login:" + ip, 15);
        const { idToken, loginState } = z
          .object({
            idToken: z.string().max(10000),
            loginState: z.string().length(43),
          })
          .parse(await requestBody(req));
        if (
          cookie(req, "etf_agent_login") !== loginState ||
          !(await store.take("login", hash(loginState)))
        )
          throw new AgentError("invalid_login_state", 403);
        let claims: FirebaseIdTokenClaims;
        try {
          claims = await options.verifyIdentity(idToken);
        } catch {
          throw new AgentError("invalid_identity", 401);
        }
        const member = claims.sub;
        if (!member || !claims.exp || claims.exp <= seconds())
          throw new AgentError("invalid_identity", 401);
        if (options.allowedMembers && !options.allowedMembers.has(member))
          throw new AgentError("beta_access_required", 403);
        const token = secret(),
          csrfToken = secret(),
          ttl = Math.min(3600, claims.exp - seconds());
        await store.put(
          "session",
          hash(token),
          { member, csrf: csrfToken },
          ttl * 1000,
        );
        // Expire the one-use nonce on a separate cookie header.
        const response = json({ authenticated: true, csrfToken });
        response.headers.append(
          "Set-Cookie",
          setCookie("etf_agent_login", "", 0),
        );
        response.headers.append(
          "Set-Cookie",
          setCookie("etf_agent_session", token, ttl),
        );
        return response;
      }
      if (method === "GET" && path === "/api/agent/session") {
        const s = await identity(req);
        return json({
          authenticated: !!s,
          csrfToken: s?.csrf ?? null,
          usage: s ? await store.usage(s.member) : null,
        });
      }
      if (method === "DELETE" && path === "/api/agent/session") {
        await csrf(req);
        await store.remove("session", hash(cookie(req, "etf_agent_session")));
        return json({ authenticated: false }, 200, {
          "Set-Cookie": setCookie("etf_agent_session", "", 0),
        });
      }
      if (method === "POST" && path === "/api/agent/authorize") {
        const s = await csrf(req),
          { request, approve } = z
            .object({ request: z.string().max(100), approve: z.boolean() })
            .parse(await requestBody(req)),
          pending = await store.take<Record<string, string>>(
            "authorization",
            hash(request),
          );
        if (!pending) throw new AgentError("authorization_expired");
        const { p } = await authorization(pending),
          destination = new URL(p.redirect_uri);
        if (p.state !== undefined)
          destination.searchParams.set("state", p.state);
        if (!approve) destination.searchParams.set("error", "access_denied");
        else {
          const code = secret();
          await store.put(
            "code",
            hash(code),
            {
              member: s.member,
              client: p.client_id,
              issued: Date.now(),
              family: secret(),
              resource,
              redirect: p.redirect_uri,
              challenge: p.code_challenge,
            } satisfies Code,
            60_000,
          );
          destination.searchParams.set("code", code);
        }
        return json({ redirect: destination.toString() });
      }
      if (method === "POST" && path === prefix + "/oauth/token") {
        await store.rate("token:" + ip, 60);
        const b = z
          .object({
            grant_type: z.enum(["authorization_code", "refresh_token"]),
            client_id: z.string().max(500),
            resource: z.literal(resource),
            code: z.string().max(500).optional(),
            redirect_uri: z.string().max(2048).optional(),
            code_verifier: z.string().max(128).optional(),
            refresh_token: z.string().max(500).optional(),
          })
          .parse(await requestBody(req));
        if (b.grant_type === "authorization_code") {
          const verifier = b.code_verifier ?? "";
          if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))
            throw new AgentError("invalid_grant");
          const key = hash(b.code ?? ""),
            g = await store.get<Code>("code", key);
          if (
            !g ||
            g.client !== b.client_id ||
            g.redirect !== b.redirect_uri ||
            g.challenge !== hash(verifier) ||
            !(await validGrant(g))
          )
            throw new AgentError("invalid_grant");
          const taken = await store.take<Code>("code", key);
          if (!taken) throw new AgentError("invalid_grant");
          return json(await issue(taken));
        }
        const key = hash(b.refresh_token ?? ""),
          used = await store.get<Grant>("used_refresh", key);
        if (used?.client === b.client_id) {
          await store.put("revoked_family", used.family, true, 31 * 86400_000);
          throw new AgentError("invalid_grant");
        }
        const g = await store.get<Grant>("refresh", key);
        if (!(await validGrant(g)) || g!.client !== b.client_id)
          throw new AgentError("invalid_grant");
        const taken = await store.take<Grant>("refresh", key);
        if (!taken) throw new AgentError("invalid_grant");
        await store.put("used_refresh", key, taken, 31 * 86400_000);
        return json(await issue(taken));
      }
      if (method === "POST" && path === prefix + "/oauth/revoke") {
        await store.rate("revoke:" + ip, 30);
        const b = z
            .object({
              token: z.string().max(500),
              client_id: z.string().max(500),
            })
            .parse(await requestBody(req)),
          key = hash(b.token),
          g =
            (await store.get<Grant>("refresh", key)) ??
            (await store.get<Grant>("access", key));
        if (g?.client === b.client_id)
          await store.put("revoked_family", g.family, true, 31 * 86400_000);
        return json({});
      }
      if (method === "POST" && path === "/api/agent/revoke-all") {
        const s = await csrf(req);
        await store.revokeMember(s.member);
        return json({ revoked: true });
      }
      return null;
    },
  };
}
