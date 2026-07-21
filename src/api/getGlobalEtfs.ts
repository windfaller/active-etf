import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import type { Db } from "mongodb";
import { enabledGlobalEtfs, findGlobalEtfConfig, globalEtfCandidates } from "../config/globalEtfs.js";
import { getDb } from "../db/mongo.js";
import type { GlobalEtfDailyReport } from "../models/GlobalEtf.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { availableGlobalEtfSourceDates, getGlobalEtfDailyReport } from "../services/globalEtf/globalEtfService.js";
import { badRequest, jsonResponse } from "./response.js";

function sanitizeGlobalSourceDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}

function sanitizeLimit(value: string | null, fallback = 180): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), 365));
}

async function globalEtfSnapshotVersion(db: Db): Promise<string> {
  const enabledCodes = enabledGlobalEtfs.map((etf) => etf.etfCode);
  const snapshotState = await db
    .collection("global_etf_snapshots")
    .aggregate<{ count: number; latestFetchedAt?: Date; latestSourceAsOf?: string }>([
      { $match: { etfCode: { $in: enabledCodes } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          latestFetchedAt: { $max: "$fetchedAt" },
          latestSourceAsOf: { $max: "$sourceAsOf" }
        }
      }
    ])
    .next();

  return [
    enabledCodes.join("."),
    snapshotState?.count ?? 0,
    snapshotState?.latestSourceAsOf ?? "none",
    snapshotState?.latestFetchedAt instanceof Date ? snapshotState.latestFetchedAt.toISOString() : "none"
  ].join(".");
}

async function getCachedGlobalEtfDailyReport(sourceDate?: string): Promise<GlobalEtfDailyReport> {
  const db = await getDb();
  const version = await globalEtfSnapshotVersion(db);
  return getOrSetDailyCache(["global-etfs", "daily-report", sourceDate ?? "latest", version], () => getGlobalEtfDailyReport(db, sourceDate));
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
  return jsonResponse(await getCachedGlobalEtfDailyReport(sanitizeGlobalSourceDate(request.query.get("date"))));
}

export async function getGlobalEtfHoldings(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode?.toUpperCase();
  if (!etfCode || !findGlobalEtfConfig(etfCode)) return badRequest("known global ETF code is required");
  const report = await getCachedGlobalEtfDailyReport(sanitizeGlobalSourceDate(request.query.get("date")));
  const section = report.sections.find((item) => item.etfCode === etfCode);
  return jsonResponse({ etfCode, date: section?.sourceAsOf ?? null, holdings: section?.topHoldings ?? [], demoMode: report.demoMode });
}

export async function getGlobalEtfChanges(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode?.toUpperCase();
  if (!etfCode || !findGlobalEtfConfig(etfCode)) return badRequest("known global ETF code is required");
  const report = await getCachedGlobalEtfDailyReport(sanitizeGlobalSourceDate(request.query.get("date")));
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
