import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { EtfCoverageRow } from "../../web/contracts/dashboard.js";
import { stockImpactsForDate } from "./stockImpactService.js";

interface LatestSummaryRow {
  etfCode: string;
  latestTradeDate: string;
  updatedAt: Date;
}

function coverageResponse(date: string, latestRows: LatestSummaryRow[], availableCodes: Set<string>) {
  const enabledEtfs = configuredEtfs.filter((etf) => etf.enabled);
  const latestByCode = new Map(latestRows.map((row) => [row.etfCode, row]));
  const etfs = enabledEtfs.map((etf) => {
    const latest = latestByCode.get(etf.etfCode);
    const hasSelectedDate = availableCodes.has(etf.etfCode);
    const latestTradeDate = latest?.latestTradeDate ?? null;
    const status: EtfCoverageRow["status"] = hasSelectedDate
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

export async function marketDashboardForDate(db: Db, date: string) {
  const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
  const [allChanges, latestRows, availableRows] = await Promise.all([
    db.collection<EtfHoldingChange>("etf_holding_changes").find({ tradeDate: date, diffShares: { $ne: 0 } }).toArray(),
    db
      .collection<EtfDailySummary>("etf_daily_summary")
      .aggregate<LatestSummaryRow>([
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
    date,
    stockImpact: await stockImpactsForDate(db, date, allChanges),
    coverage: coverageResponse(date, latestRows, new Set(availableRows.map((row) => row.etfCode)))
  };
}
