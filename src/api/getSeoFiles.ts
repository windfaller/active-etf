import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { siteBaseUrlFromHostCandidates } from "../services/seo/siteUrls.js";
import { buildRobotsTxt, buildSitemapXml } from "../services/seo/sitemap.js";

function forwardedHost(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/(?:^|[;,]\s*)host="?([^";,]+)"?/iu);
  return match?.[1] ?? null;
}

function requestBaseUrl(request: HttpRequest): string {
  return siteBaseUrlFromHostCandidates([
    request.url,
    request.headers.get("host"),
    request.headers.get("x-original-host"),
    forwardedHost(request.headers.get("forwarded")),
    request.headers.get("x-forwarded-host")
  ]);
}

function textResponse(body: string, contentType: string): HttpResponseInit {
  return {
    status: 200,
    body,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600"
    }
  };
}

export async function getSitemapXml(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return textResponse(buildSitemapXml(requestBaseUrl(request)), "application/xml; charset=utf-8");
}

export async function getRobotsTxt(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return textResponse(buildRobotsTxt(requestBaseUrl(request)), "text/plain; charset=utf-8");
}

app.http("getSitemapXml", {
  methods: ["GET", "HEAD"],
  route: "sitemap.xml",
  authLevel: "anonymous",
  handler: getSitemapXml
});

app.http("getRobotsTxt", {
  methods: ["GET", "HEAD"],
  route: "robots.txt",
  authLevel: "anonymous",
  handler: getRobotsTxt
});
