import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { stockImpactsForDate } from "../services/market/stockImpactService.js";
import { tagMovementsForChanges } from "../services/sector/tagMovementService.js";
import { assertTradeDate } from "../utils/date.js";
import { badRequest, jsonResponse } from "./response.js";

async function changesResponse(db: Awaited<ReturnType<typeof getDb>>, etfCode: string, date: string, changes: EtfHoldingChange[]) {
  return {
    etfCode,
    date,
    topIncreases: changes.filter((change) => change.diffShares > 0).sort((a, b) => b.diffShares - a.diffShares),
    topDecreases: changes.filter((change) => change.diffShares < 0).sort((a, b) => a.diffShares - b.diffShares),
    topActiveIncreases: changes
      .filter((change) => (change.activeDiffShares ?? 0) > 0)
      .sort((a, b) => (b.activeDiffShares ?? 0) - (a.activeDiffShares ?? 0)),
    topActiveDecreases: changes
      .filter((change) => (change.activeDiffShares ?? 0) < 0)
      .sort((a, b) => (a.activeDiffShares ?? 0) - (b.activeDiffShares ?? 0)),
    newHoldings: changes.filter((change) => change.status === "new" || (change.prevShares === 0 && change.currentShares > 0)),
    exitedHoldings: changes.filter((change) => change.status === "exit" || (change.prevShares > 0 && change.currentShares === 0)),
    tagMovements: await tagMovementsForChanges(db, changes)
  };
}

function coverageResponse(date: string, latestRows: Array<{ etfCode: string; latestTradeDate: string; updatedAt: Date }>, availableCodes: Set<string>) {
  const enabledEtfs = configuredEtfs.filter((etf) => etf.enabled);
  const latestByCode = new Map(latestRows.map((row) => [row.etfCode, row]));
  const etfs = enabledEtfs.map((etf) => {
    const latest = latestByCode.get(etf.etfCode);
    const hasSelectedDate = availableCodes.has(etf.etfCode);
    const latestTradeDate = latest?.latestTradeDate ?? null;
    const status = hasSelectedDate
      ? "available"
      : latestTradeDate === null
        ? "missing"
        : latestTradeDate < date
          ? "stale"
          : "newer_available";

    return {
      etfCode: etf.etfCode,
      name: etf.name,
      issuer: etf.issuer,
      providerId: etf.source.providerId ?? "ezmoney",
      latestTradeDate,
      hasSelectedDate,
      status,
      updatedAt: latest?.updatedAt ?? null
    };
  });

  return {
    date,
    trackedCount: etfs.length,
    availableCount: etfs.filter((etf) => etf.hasSelectedDate).length,
    staleCount: etfs.filter((etf) => etf.status === "stale" || etf.status === "missing").length,
    etfs
  };
}

export async function getDashboard(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.query.get("etfCode");
  const dateParam = request.query.get("date");
  if (!etfCode || !dateParam) return badRequest("etfCode and date are required");
  const date = assertTradeDate(dateParam);

  const body = await getOrSetDailyCache(["dashboard", etfCode, date], async () => {
    const db = await getDb();
    const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
    const [holdings, summary, etfChanges, summaries, allChanges, latestRows, availableRows] = await Promise.all([
      db
        .collection<EtfDailyHolding>("etf_daily_holdings")
        .find({ etfCode, tradeDate: date })
        .sort({ weight: -1, marketValue: -1 })
        .toArray(),
      db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode, tradeDate: date }),
      db.collection<EtfHoldingChange>("etf_holding_changes").find({ etfCode, tradeDate: date }).toArray(),
      db.collection<EtfDailySummary>("etf_daily_summary").find({ etfCode }).sort({ tradeDate: -1 }).limit(90).toArray(),
      db.collection<EtfHoldingChange>("etf_holding_changes").find({ tradeDate: date, diffShares: { $ne: 0 } }).toArray(),
      db
        .collection<EtfDailySummary>("etf_daily_summary")
        .aggregate<{ etfCode: string; latestTradeDate: string; updatedAt: Date }>([
          { $match: { etfCode: { $in: enabledCodes } } },
          { $sort: { tradeDate: -1 } },
          { $group: { _id: "$etfCode", latestTradeDate: { $first: "$tradeDate" }, updatedAt: { $first: "$updatedAt" } } },
          { $project: { _id: 0, etfCode: "$_id", latestTradeDate: 1, updatedAt: 1 } }
        ])
        .toArray(),
      db
        .collection<EtfDailySummary>("etf_daily_summary")
        .find({ etfCode: { $in: enabledCodes }, tradeDate: date }, { projection: { _id: 0, etfCode: 1 } })
        .toArray()
    ]);

    const stockImpact = await stockImpactsForDate(db, date, allChanges);

    return {
      etfCode,
      date,
      holdings,
      summary,
      changes: await changesResponse(db, etfCode, date, etfChanges),
      summaries,
      stockImpact,
      coverage: coverageResponse(date, latestRows, new Set(availableRows.map((row) => row.etfCode)))
    };
  });

  return jsonResponse(body);
}

app.http("getDashboard", {
  methods: ["GET"],
  route: "dashboard",
  authLevel: "anonymous",
  handler: getDashboard
});
