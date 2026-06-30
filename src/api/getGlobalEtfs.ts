import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { enabledGlobalEtfs, findGlobalEtfConfig, globalEtfCandidates } from "../config/globalEtfs.js";
import { getDb } from "../db/mongo.js";
import type { GlobalEtfDailyReport } from "../models/GlobalEtf.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { getGlobalEtfDailyReport } from "../services/globalEtf/globalEtfService.js";
import { badRequest, jsonResponse } from "./response.js";

async function getCachedGlobalEtfDailyReport(): Promise<GlobalEtfDailyReport> {
  const db = await getDb();
  return getOrSetDailyCache(["global-etfs", "daily-report"], () => getGlobalEtfDailyReport(db));
}

export async function getEnabledGlobalEtfs(_request: HttpRequest, _context: InvocationContext) {
  return jsonResponse({
    productGroup: "global_etf",
    enabled: enabledGlobalEtfs,
    candidates: globalEtfCandidates.filter((etf) => !etf.enabled)
  });
}

export async function getGlobalEtfDailyReportApi(_request: HttpRequest, _context: InvocationContext) {
  return jsonResponse(await getCachedGlobalEtfDailyReport());
}

export async function getGlobalEtfHoldings(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode?.toUpperCase();
  if (!etfCode || !findGlobalEtfConfig(etfCode)) return badRequest("known global ETF code is required");
  const report = await getCachedGlobalEtfDailyReport();
  const section = report.sections.find((item) => item.etfCode === etfCode);
  return jsonResponse({ etfCode, date: section?.sourceAsOf ?? null, holdings: section?.topHoldings ?? [], demoMode: report.demoMode });
}

export async function getGlobalEtfChanges(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode?.toUpperCase();
  if (!etfCode || !findGlobalEtfConfig(etfCode)) return badRequest("known global ETF code is required");
  const report = await getCachedGlobalEtfDailyReport();
  const section = report.sections.find((item) => item.etfCode === etfCode);
  return jsonResponse({
    etfCode,
    date: section?.sourceAsOf ?? null,
    changes: section
      ? {
          newPositions: section.newPositions,
          exitedPositions: section.exitedPositions,
          weightChanges: section.weightChanges,
          shareChanges: section.shareChanges,
          marketValueChanges: section.marketValueChanges,
          sectorChanges: section.sectorChanges,
          countryChanges: section.countryChanges
        }
      : null,
    demoMode: report.demoMode
  });
}

app.http("getEnabledGlobalEtfs", {
  methods: ["GET"],
  route: "global-etfs/enabled",
  authLevel: "anonymous",
  handler: getEnabledGlobalEtfs
});

app.http("getGlobalEtfDailyReport", {
  methods: ["GET"],
  route: "global-etfs/daily-report",
  authLevel: "anonymous",
  handler: getGlobalEtfDailyReportApi
});

app.http("getGlobalEtfHoldings", {
  methods: ["GET"],
  route: "global-etf/{etfCode}/holdings",
  authLevel: "anonymous",
  handler: getGlobalEtfHoldings
});

app.http("getGlobalEtfChanges", {
  methods: ["GET"],
  route: "global-etf/{etfCode}/changes",
  authLevel: "anonymous",
  handler: getGlobalEtfChanges
});
