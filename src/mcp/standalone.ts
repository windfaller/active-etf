import { app, HttpRequest, type HttpResponseInit } from "@azure/functions";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { memberMcp } from "../api/memberMcp.js";

const root = resolve(process.cwd(), "public-agent");
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8" };
const supportCopy = {
  en: { title: "ETF Holdings Radar support", intro: "For help with account access, OAuth connections, research-point usage, or ETF data, email us." },
  "zh-TW": { title: "ETF 持倉雷達客服", intro: "帳號登入、OAuth 連接、研究點數或 ETF 資料若有問題，請寄信給我們。" },
  "zh-CN": { title: "ETF 持仓雷达客服", intro: "如需协助处理账号登录、OAuth 连接、研究点数或 ETF 数据，请发送电子邮件。" },
  ja: { title: "ETF Holdings Radar サポート", intro: "アカウント、OAuth 接続、調査ポイント、ETF データについてはメールでお問い合わせください。" },
  ko: { title: "ETF Holdings Radar 지원", intro: "계정, OAuth 연결, 리서치 포인트 또는 ETF 데이터에 관한 문의는 이메일로 보내주세요." },
} as const;
type SupportLocale = keyof typeof supportCopy;
function supportPage(locale: SupportLocale, method: string): HttpResponseInit {
  const copy = supportCopy[locale];
  const body = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.title}</title><meta name="description" content="${copy.intro}"><style>body{margin:0;background:#08151b;color:#edf7f5;font:16px/1.65 system-ui,sans-serif}main{max-width:760px;margin:8vh auto;padding:32px}a{color:#7ce3d0}nav{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:32px}h1{font-size:2rem}p{color:#cbdcda}.contact{border:1px solid #447874;border-radius:16px;padding:24px;background:#10252b}</style></head><body><main><nav>${Object.keys(supportCopy).map((lang) => `<a href="/${lang}/mcp/support" hreflang="${lang}">${lang}</a>`).join("")}</nav><h1>${copy.title}</h1><p>${copy.intro}</p><div class="contact"><a href="mailto:service@inthewins.com">service@inthewins.com</a></div><p><a href="/${locale}/mcp">ETF Holdings Radar</a></p></main></body></html>`;
  return {status: 200, body: method === "HEAD" ? undefined : body, headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"}};
}
export async function standaloneMcp(request: HttpRequest): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return memberMcp(request);
  if (url.pathname === "/.well-known/openai-apps-challenge") {
    const token = process.env.OPENAI_PLUGIN_DOMAIN_CHALLENGE?.trim();
    if (!token || !["GET", "HEAD"].includes(request.method)) return {status: 404, headers: {"Cache-Control": "no-store"}, body: "Not found"};
    return {status: 200, body: request.method === "HEAD" ? undefined : token, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}};
  }
  const supportMatch = /^\/(en|zh-TW|zh-CN|ja|ko)\/mcp\/support\/?$/.exec(url.pathname);
  if (supportMatch && ["GET", "HEAD"].includes(request.method)) return supportPage(supportMatch[1] as SupportLocale, request.method);
  if (url.pathname.startsWith("/.well-known/")) {
    url.pathname = "/api" + url.pathname;
    // Resource-path discovery complements the explicit WWW-Authenticate URL.
    if (url.pathname === "/api/.well-known/oauth-protected-resource/api/mcp") url.pathname = "/api/.well-known/oauth-protected-resource/mcp";
    return memberMcp(new HttpRequest({method: request.method, url: url.toString(), headers: Object.fromEntries(request.headers)}));
  }
  let file = "";
  if (/^\/(en|zh-TW|zh-CN|ja|ko)\/mcp(?:\/(?:skill|connect))?\/?$/.test(url.pathname)) file = url.pathname.replace(/\/$/, "") + "/index.html";
  else if (/^\/skills\/(en|zh-TW|zh-CN|ja|ko)\/active-etf-research\/SKILL\.md$/.test(url.pathname)) file = url.pathname;
  else if (/^\/assets\/[A-Za-z0-9_.-]+$/.test(url.pathname) || ["/favicon.svg", "/app-version.json", "/robots.txt", "/sitemap.xml"].includes(url.pathname)) file = url.pathname;
  if (!file || !["GET", "HEAD"].includes(request.method)) return {status: 404, headers: {"Cache-Control": "no-store", "X-Robots-Tag": "noindex"}, body: "Not found"};
  try {
    const body = await readFile(resolve(root, "." + file));
    const indexable = /^\/(en|zh-TW|zh-CN|ja|ko)\/mcp(?:\/skill)?\/index\.html$/.test(file);
    return {status: 200, body: request.method === "HEAD" ? undefined : body, headers: {"Content-Type": mime[extname(file)] ?? "application/octet-stream", "Cache-Control": "public, max-age=300", ...(indexable || file === "/robots.txt" || file === "/sitemap.xml" ? {} : {"X-Robots-Tag": "noindex, nofollow"}), "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"}};
  } catch { return {status: 404, body: "Not found"}; }
}
app.http("standaloneMcp", { route: "{*path}", authLevel: "anonymous", methods: ["GET", "HEAD", "POST", "DELETE", "OPTIONS"], handler: standaloneMcp });
