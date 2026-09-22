import { app, HttpRequest, type HttpResponseInit } from "@azure/functions";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { memberMcp } from "../api/memberMcp.js";

const root = resolve(process.cwd(), "public-agent");
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };
export async function standaloneMcp(request: HttpRequest): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return memberMcp(request);
  if (url.pathname.startsWith("/.well-known/")) {
    url.pathname = "/api" + url.pathname;
    // Resource-path discovery complements the explicit WWW-Authenticate URL.
    if (url.pathname === "/api/.well-known/oauth-protected-resource/api/mcp") url.pathname = "/api/.well-known/oauth-protected-resource/mcp";
    return memberMcp(new HttpRequest({method: request.method, url: url.toString(), headers: Object.fromEntries(request.headers)}));
  }
  let file = "";
  if (/^\/(en|zh-TW|zh-CN|ja|ko)\/mcp(?:\/connect)?\/?$/.test(url.pathname)) file = url.pathname.replace(/\/$/, "") + "/index.html";
  else if (/^\/assets\/[A-Za-z0-9_.-]+$/.test(url.pathname) || ["/favicon.svg", "/app-version.json"].includes(url.pathname)) file = url.pathname;
  if (!file || !["GET", "HEAD"].includes(request.method)) return {status: 404, headers: {"Cache-Control": "no-store", "X-Robots-Tag": "noindex"}, body: "Not found"};
  try {
    const body = await readFile(resolve(root, "." + file));
    return {status: 200, body: request.method === "HEAD" ? undefined : body, headers: {"Content-Type": mime[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"}};
  } catch { return {status: 404, body: "Not found"}; }
}
app.http("standaloneMcp", { route: "{*path}", authLevel: "anonymous", methods: ["GET", "HEAD", "POST", "DELETE", "OPTIONS"], handler: standaloneMcp });
