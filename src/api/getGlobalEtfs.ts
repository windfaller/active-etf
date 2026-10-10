import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { maskMemberResults, maskMemberResultsByStableKey } from "../domain/memberAccess.js";
import { enabledGlobalEtfs, findGlobalEtfConfig, globalEtfCandidates } from "../config/globalEtfs.js";
import { getDb } from "../db/mongo.js";
import type { GlobalEtfDailyReport } from "../models/GlobalEtf.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { availableGlobalEtfSourceDates, getGlobalEtfDailyReport } from "../services/globalEtf/globalEtfService.js";
import { projectGlobalEtfWebReport } from "../services/globalEtf/webReportProjection.js";
import type { GlobalEtfWebReport } from "../services/globalEtf/webReportProjection.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";
import { badRequest, jsonResponse } from "./response.js";

function sanitizeGlobalSourceDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}

function sanitizeLimit(value: string | null, fallback = 180): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), 365));
}

async function getCachedGlobalEtfDailyReport(sourceDate?: string, generation?: string): Promise<GlobalEtfDailyReport> {
  return getOrSetDailyCache(
    ["global-etfs", "daily-report", enabledGlobalEtfs.map((etf) => etf.etfCode).join("."), sourceDate ?? new Date().toISOString().slice(0, 10)],
    async () => getGlobalEtfDailyReport(await getDb(), sourceDate),
    undefined,
    undefined,
    generation
  );
}

async function getCachedGlobalEtfWebReport(sourceDate?: string) {
  return getOrSetDailyCache(
    ["global-etfs", "web-report", "v3", enabledGlobalEtfs.map((etf) => etf.etfCode).join("."), sourceDate ?? new Date().toISOString().slice(0, 10)],
    async (generation) => projectGlobalEtfWebReport(await getCachedGlobalEtfDailyReport(sourceDate, generation))
  );
}

export function projectGlobalWebReportForMember(report: GlobalEtfWebReport, authenticated: boolean) {
  return {
    ...report,
    commonHoldings: maskMemberResultsByStableKey(report.commonHoldings, authenticated, (row) => `common:${row.ticker ?? row.name}`),
    commonWeightChanges: maskMemberResultsByStableKey(report.commonWeightChanges, authenticated, (row) => `common-change:${row.ticker ?? row.name}`),
    sections: report.sections.map((section) => ({
      ...section,
      topHoldings: maskMemberResultsByStableKey(section.topHoldings, authenticated, (row) => `${section.etfCode}:holding:${row.ticker ?? row.name}`),
      weightChanges: maskMemberResultsByStableKey(section.weightChanges, authenticated, (row) => `${section.etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`)
    }))
  };
}

export function projectGlobalRawReportForMember(report: GlobalEtfDailyReport, authenticated: boolean) {
  if (authenticated) return report;
  return {
    ...report,
    highlights: maskMemberResults(report.highlights, false, "after-first"),
    commonHoldings: maskMemberResultsByStableKey(report.commonHoldings, false, (row) => `common:${row.ticker ?? row.name}`),
    globalMovers: maskMemberResultsByStableKey(report.globalMovers, false, (row) => `global-change:${row.etfCode}:${row.positionKey ?? row.ticker ?? row.name}`),
    sections: report.sections.map((section) => ({
      ...section,
      topHoldings: maskMemberResultsByStableKey(section.topHoldings, false, (row) => `${section.etfCode}:holding:${row.ticker ?? row.name}`),
      newPositions: maskMemberResultsByStableKey(section.newPositions, false, (row) => `${section.etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
      exitedPositions: maskMemberResultsByStableKey(section.exitedPositions, false, (row) => `${section.etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
      weightChanges: maskMemberResultsByStableKey(section.weightChanges, false, (row) => `${section.etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
      shareChanges: maskMemberResultsByStableKey(section.shareChanges, false, (row) => `${section.etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
      marketValueChanges: maskMemberResultsByStableKey(section.marketValueChanges, false, (row) => `${section.etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
      sectorChanges: maskMemberResultsByStableKey(section.sectorChanges, false, (row) => `${section.etfCode}:sector:${row.name}`),
      countryChanges: maskMemberResultsByStableKey(section.countryChanges, false, (row) => `${section.etfCode}:country:${row.name}`),
      takeaway: "完整解讀限會員"
    })),
    html: ""
  };
}

export async function getEnabledGlobalEtfs(_request: HttpRequest, _context: InvocationContext) {
  return jsonResponse({
    productGroup: "global_etf",
    enabled: enabledGlobalEtfs,
    candidates: globalEtfCandidates.filter((etf) => !etf.enabled)
  });
}

export async function getGlobalEtfDates(request: HttpRequest, _context: InvocationContext) {
  const db = await getDb();
  const dates = await availableGlobalEtfSourceDates(db, sanitizeLimit(request.query.get("limit")));
  return jsonResponse({ dates });
}

export async function getGlobalEtfDailyReportApi(request: HttpRequest, _context: InvocationContext) {
  const sourceDate = sanitizeGlobalSourceDate(request.query.get("date"));
  const access = await memberRequestAccess(request);
  if (request.query.get("format") === "web") {
    return memberJsonResponse(projectGlobalWebReportForMember(await getCachedGlobalEtfWebReport(sourceDate), access.authenticated));
  }
  return memberJsonResponse(projectGlobalRawReportForMember(await getCachedGlobalEtfDailyReport(sourceDate), access.authenticated));
}

export async function getGlobalEtfHoldings(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode?.toUpperCase();
  if (!etfCode || !findGlobalEtfConfig(etfCode)) return badRequest("known global ETF code is required");
  const report = await getCachedGlobalEtfDailyReport(sanitizeGlobalSourceDate(request.query.get("date")));
  const section = report.sections.find((item) => item.etfCode === etfCode);
  const access = await memberRequestAccess(request);
  return memberJsonResponse({
    etfCode,
    date: section?.sourceAsOf ?? null,
    holdings: maskMemberResultsByStableKey(section?.topHoldings ?? [], access.authenticated, (row) => `${etfCode}:holding:${row.ticker ?? row.name}`),
    demoMode: report.demoMode
  });
}

export async function getGlobalEtfChanges(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode?.toUpperCase();
  if (!etfCode || !findGlobalEtfConfig(etfCode)) return badRequest("known global ETF code is required");
  const report = await getCachedGlobalEtfDailyReport(sanitizeGlobalSourceDate(request.query.get("date")));
  const section = report.sections.find((item) => item.etfCode === etfCode);
  const access = await memberRequestAccess(request);
  return memberJsonResponse({
    etfCode,
    date: section?.sourceAsOf ?? null,
    changes: section
      ? {
          newPositions: maskMemberResultsByStableKey(section.newPositions, access.authenticated, (row) => `${etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
          exitedPositions: maskMemberResultsByStableKey(section.exitedPositions, access.authenticated, (row) => `${etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
          weightChanges: maskMemberResultsByStableKey(section.weightChanges, access.authenticated, (row) => `${etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
          shareChanges: maskMemberResultsByStableKey(section.shareChanges, access.authenticated, (row) => `${etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
          marketValueChanges: maskMemberResultsByStableKey(section.marketValueChanges, access.authenticated, (row) => `${etfCode}:change:${row.positionKey ?? row.ticker ?? row.name}`),
          sectorChanges: maskMemberResultsByStableKey(section.sectorChanges, access.authenticated, (row) => `${etfCode}:sector:${row.name}`),
          countryChanges: maskMemberResultsByStableKey(section.countryChanges, access.authenticated, (row) => `${etfCode}:country:${row.name}`)
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

app.http("getGlobalEtfDates", {
  methods: ["GET"],
  route: "global-etfs/dates",
  authLevel: "anonymous",
  handler: getGlobalEtfDates
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
