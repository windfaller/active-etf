import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { enabledGlobalEtfs } from "../config/globalEtfs.js";
import { getDb } from "../db/mongo.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import type { GlobalEtfSnapshot } from "../models/GlobalEtf.js";
import { marketDateOverview } from "../services/market/marketDatesService.js";
import { defaultSiteBaseUrl } from "../services/seo/siteUrls.js";
import { buildRobotsTxt, buildSitemapXml, type SitemapLastModifiedByPath } from "../services/seo/sitemap.js";

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

function newest(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort((left, right) => right.localeCompare(left))[0];
}

export function sitemapLastModifiedPaths(
  taiwanDates: Map<string, string>,
  globalDates: Map<string, string>,
  routeDates: { recommendedTaiwanDate?: string; usMuDate?: string } = {}
): SitemapLastModifiedByPath {
  const result: SitemapLastModifiedByPath = {};
  const taiwanLatest = newest([...taiwanDates.values()]);
  const globalLatest = newest([...globalDates.values()]);
  const institutionLatest = newest(
    enabledGlobalEtfs
      .filter((etf) => etf.strategyType === "13f")
      .map((etf) => globalDates.get(etf.etfCode))
  );
  for (const path of ["/", "/market"]) {
    result[path] = taiwanLatest;
  }
  for (const path of ["/stocks/tw/2330", "/signals", "/signals/consecutive", "/signals/reversals", "/signals/divergence"]) {
    result[path] = routeDates.recommendedTaiwanDate;
  }
  result["/stocks/us/MU"] = routeDates.usMuDate;
  result["/global-etfs"] = globalLatest;
  result["/institutions"] = institutionLatest;

  for (const etf of configuredEtfs.filter((row) => row.enabled)) {
    const date = taiwanDates.get(etf.etfCode);
    for (const path of [
      `/etf/${etf.etfCode}`,
      `/etf/${etf.etfCode}/changes`,
      `/etf/${etf.etfCode}/premium-history`,
      `/etf/${etf.etfCode}/style`
    ]) result[path] = date;
  }
  for (const etf of enabledGlobalEtfs) {
    const family = etf.strategyType === "13f" ? "institutions" : "global-etfs";
    result[`/${family}/${etf.etfCode}`] = globalDates.get(etf.etfCode);
  }
  return result;
}

async function loadSitemapLastModifiedPaths(): Promise<SitemapLastModifiedByPath> {
  const db = await getDb();
  const [taiwanRows, globalRows, marketOverview, usMuSnapshot] = await Promise.all([
    db.collection<EtfDailySummary>("etf_daily_summary").aggregate<{ _id: string; date: string }>([
      { $match: { etfCode: { $in: configuredEtfs.filter((row) => row.enabled).map((row) => row.etfCode) }, tradeDate: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" } } },
      { $group: { _id: "$etfCode", date: { $max: "$tradeDate" } } }
    ]).toArray(),
    db.collection<GlobalEtfSnapshot>("global_etf_snapshots").aggregate<{ _id: string; date: string }>([
      { $match: { etfCode: { $in: enabledGlobalEtfs.map((row) => row.etfCode) }, sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" }, sourceStatus: "ok" } },
      { $group: { _id: "$etfCode", date: { $max: "$sourceAsOf" } } }
    ]).toArray(),
    marketDateOverview(db, 5),
    db.collection<GlobalEtfSnapshot>("global_etf_snapshots").findOne(
      {
        strategyType: { $ne: "13f" },
        sourceStatus: "ok",
        sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" },
        "holdings.ticker": "MU"
      },
      { sort: { sourceAsOf: -1, fetchedAt: -1 }, projection: { _id: 0, sourceAsOf: 1 } }
    )
  ]);
  return sitemapLastModifiedPaths(
    new Map(taiwanRows.map((row) => [row._id, row.date])),
    new Map(globalRows.map((row) => [row._id, row.date])),
    {
      recommendedTaiwanDate: marketOverview.recommendedDate ?? undefined,
      usMuDate: usMuSnapshot?.sourceAsOf
    }
  );
}

export async function getSitemapXml(_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let lastModifiedByPath: SitemapLastModifiedByPath = {};
  try {
    lastModifiedByPath = await loadSitemapLastModifiedPaths();
  } catch (error) {
    context.warn?.("Sitemap freshness lookup failed; publishing URLs without synthetic lastmod.", error);
  }
  return textResponse(buildSitemapXml(defaultSiteBaseUrl, lastModifiedByPath), "application/xml; charset=utf-8");
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
