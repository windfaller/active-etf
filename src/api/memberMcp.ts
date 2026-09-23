import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type Cookie,
} from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { verifyFirebaseIdToken } from "../services/auth/firebaseTokenVerifier.js";
import { MongoAgentStore } from "../mcp/mongoStore.js";
import { createAgentHandler } from "../mcp/handler.js";
import { cachedResearchProvider } from "../mcp/cachedProvider.js";
import { createResearchProvider } from "../mcp/data.js";
function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error("timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}
let application: Promise<ReturnType<typeof createAgentHandler>> | undefined;
function getApplication() {
  if (!application)
    application = (async () => {
      const origin = (
        process.env.MCP_PUBLIC_ORIGIN ??
        "https://active-etf-mcp.inthewins.com"
      ).replace(/\/$/, "");
      if (new URL(origin).origin !== origin || !origin.startsWith("https://"))
        throw Error("Invalid MCP origin");
      const db = await getDb(),
        store = new MongoAgentStore(db);
      await store.ensureIndexes();
      const allow = process.env.MCP_BETA_MEMBER_IDS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const releaseStage = process.env.MCP_RELEASE_STAGE ?? "test";
      if (releaseStage !== "test" && releaseStage !== "production")
        throw Error("Invalid MCP release stage");
      if (releaseStage === "production" && allow?.length)
        throw Error("Production member MCP cannot retain a beta allowlist");
      return createAgentHandler({
        origin,
        apiPrefix: "/api",
        store,
        verifyIdentity: (token) => bounded(verifyFirebaseIdToken(token), 5000),
        requestTimeoutMs: 15000,
        allowedMembers: allow?.length ? new Set(allow) : undefined,
        provider: cachedResearchProvider(createResearchProvider(getDb)),
        releaseStage,
      });
    })().catch((e) => {
      application = undefined;
      throw e;
    });
  return application;
}
function responseCookies(response: Response): Cookie[] {
  return response.headers.getSetCookie().map((value) => {
    const parts = value.split(";").map((s) => s.trim()),
      [name, ...rest] = parts[0].split("=");
    return {
      name,
      value: rest.join("="),
      path: "/",
      httpOnly: true,
      secure: parts.includes("Secure"),
      sameSite: "Lax",
      maxAge: Number(
        parts.find((s) => s.startsWith("Max-Age="))?.slice(8) ?? 0,
      ),
    };
  });
}
export async function memberMcp(
  request: HttpRequest,
): Promise<HttpResponseInit> {
  try {
    const handler = await bounded(getApplication(), 5000);
    const headers = new Headers();
    request.headers.forEach((v, k) => headers.set(k, v));
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.text();
    if (body && Buffer.byteLength(body) > 32768)
      return { status: 413, jsonBody: { error: "request_too_large" } };
    const result = await handler(
      new Request(request.url, { method: request.method, headers, body }),
      "swa-ingress",
    );
    const responseHeaders: Record<string, string> = {};
    result.headers.forEach((v, k) => {
      if (k !== "set-cookie") responseHeaders[k] = v;
    });
    return {
      status: result.status,
      headers: responseHeaders,
      cookies: responseCookies(result),
      body: await result.text(),
    };
  } catch {
    return {
      status: 503,
      headers: { "Cache-Control": "no-store" },
      jsonBody: { error: "temporarily_unavailable" },
    };
  }
}
if (process.env.MCP_STANDALONE !== "true") for (const [name, route] of [
  ["memberMcp", "mcp"],
  ["memberMcpOAuth", "oauth/{*path}"],
  ["memberMcpAccount", "agent/{*path}"],
  ["memberMcpDiscovery", ".well-known/{*path}"],
  ["memberMcpHealth", "mcp-health"],
])
  app.http(name, {
    route,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    authLevel: "anonymous",
    handler: memberMcp,
  });
