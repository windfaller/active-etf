import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { siteBaseUrlFromHost } from "../services/seo/siteUrls.js";
import { buildRobotsTxt, buildSitemapXml } from "../services/seo/sitemap.js";

function requestHost(request: HttpRequest): string | null {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
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
  return textResponse(buildSitemapXml(siteBaseUrlFromHost(requestHost(request))), "application/xml; charset=utf-8");
}

export async function getRobotsTxt(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return textResponse(buildRobotsTxt(siteBaseUrlFromHost(requestHost(request))), "text/plain; charset=utf-8");
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
