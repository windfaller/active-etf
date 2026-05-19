import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { assertTradeDate } from "../utils/date.js";
import { badRequest, jsonResponse } from "./response.js";

function changesResponse(etfCode: string, date: string, changes: EtfHoldingChange[]) {
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
    exitedHoldings: changes.filter((change) => change.status === "exit" || (change.prevShares > 0 && change.currentShares === 0))
  };
}

function stockImpacts(date: string, changes: EtfHoldingChange[]) {
  const rowsByStock = new Map<string, any>();

  for (const change of changes) {
    const row =
      rowsByStock.get(change.stockId) ??
      {
        stockId: change.stockId,
        stockName: change.stockName,
        etfCount: 0,
        increaseEtfCount: 0,
        decreaseEtfCount: 0,
        totalDiffLots: 0,
        totalActiveDiffLots: 0,
        totalDiffWeightPoint: 0,
        maxAbsActiveDiffLots: 0,
        maxAbsDiffWeightPoint: 0,
        impactScore: 0,
        primaryImpactEtf: null,
        etfs: []
      };
    const activeDiffLots = change.activeDiffLots ?? change.diffLots;
    const diffWeightPoint = change.diffWeightPoint ?? 0;
    const etfImpact = {
      etfCode: change.etfCode,
      diffLots: change.diffLots,
      activeDiffLots: change.activeDiffLots,
      diffWeightPoint: change.diffWeightPoint,
      currentWeight: change.currentWeight,
      status: change.status
    };
    const primaryMagnitude = Math.abs(row.primaryImpactEtf?.activeDiffLots ?? row.primaryImpactEtf?.diffLots ?? 0);

    row.etfs.push(etfImpact);
    row.etfCount += 1;
    row.increaseEtfCount += activeDiffLots > 0 ? 1 : 0;
    row.decreaseEtfCount += activeDiffLots < 0 ? 1 : 0;
    row.totalDiffLots += change.diffLots;
    row.totalActiveDiffLots += activeDiffLots;
    row.totalDiffWeightPoint += diffWeightPoint;
    row.maxAbsActiveDiffLots = Math.max(row.maxAbsActiveDiffLots, Math.abs(activeDiffLots));
    row.maxAbsDiffWeightPoint = Math.max(row.maxAbsDiffWeightPoint, Math.abs(diffWeightPoint));
    if (!row.primaryImpactEtf || Math.abs(activeDiffLots) > primaryMagnitude) row.primaryImpactEtf = etfImpact;
    rowsByStock.set(change.stockId, row);
  }

  const impacts = [...rowsByStock.values()]
    .map((row) => ({
      ...row,
      impactScore: Math.round(row.maxAbsActiveDiffLots * 100 + row.maxAbsDiffWeightPoint * 10000) / 100
    }))
    .sort((a, b) => b.impactScore - a.impactScore);

  return { date, impacts };
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

    return {
      etfCode,
      date,
      holdings,
      summary,
      changes: changesResponse(etfCode, date, etfChanges),
      summaries,
      stockImpact: stockImpacts(date, allChanges),
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
