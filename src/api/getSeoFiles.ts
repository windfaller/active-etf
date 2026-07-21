import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { defaultSiteBaseUrl } from "../services/seo/siteUrls.js";
import { buildRobotsTxt, buildSitemapXml } from "../services/seo/sitemap.js";

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

export async function getSitemapXml(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return textResponse(buildSitemapXml(defaultSiteBaseUrl), "application/xml; charset=utf-8");
}

export async function getRobotsTxt(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return textResponse(buildRobotsTxt(defaultSiteBaseUrl), "text/plain; charset=utf-8");
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
