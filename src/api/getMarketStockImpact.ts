import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { badRequest, jsonResponse } from "./response.js";

interface StockImpactEtf {
  etfCode: string;
  diffLots: number;
  activeDiffLots: number | null;
  diffWeightPoint: number | null;
  currentWeight: number | null;
  status: string;
}

interface StockImpactRow {
  stockId: string;
  stockName: string;
  etfCount: number;
  increaseEtfCount: number;
  decreaseEtfCount: number;
  totalDiffLots: number;
  totalActiveDiffLots: number;
  totalDiffWeightPoint: number;
  maxAbsActiveDiffLots: number;
  maxAbsDiffWeightPoint: number;
  impactScore: number;
  primaryImpactEtf: StockImpactEtf | null;
  etfs: StockImpactEtf[];
}

function toNumber(value: number | null | undefined): number {
  return value ?? 0;
}

export async function getMarketStockImpact(request: HttpRequest, _context: InvocationContext) {
  const date = request.query.get("date");
  if (!date) return badRequest("date is required");

  const db = await getDb();
  const changes = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({ tradeDate: date, diffShares: { $ne: 0 } })
    .toArray();

  const rowsByStock = new Map<string, StockImpactRow>();

  for (const change of changes) {
    const row =
      rowsByStock.get(change.stockId) ??
      ({
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
      } satisfies StockImpactRow);

    const activeDiffLots = change.activeDiffLots ?? change.diffLots;
    const diffWeightPoint = change.diffWeightPoint ?? 0;
    const etfImpact: StockImpactEtf = {
      etfCode: change.etfCode,
      diffLots: change.diffLots,
      activeDiffLots: change.activeDiffLots,
      diffWeightPoint: change.diffWeightPoint,
      currentWeight: change.currentWeight,
      status: change.status
    };

    row.etfs.push(etfImpact);
    row.etfCount += 1;
    row.increaseEtfCount += activeDiffLots > 0 ? 1 : 0;
    row.decreaseEtfCount += activeDiffLots < 0 ? 1 : 0;
    row.totalDiffLots += change.diffLots;
    row.totalActiveDiffLots += activeDiffLots;
    row.totalDiffWeightPoint += diffWeightPoint;
    row.maxAbsActiveDiffLots = Math.max(row.maxAbsActiveDiffLots, Math.abs(activeDiffLots));
    row.maxAbsDiffWeightPoint = Math.max(row.maxAbsDiffWeightPoint, Math.abs(diffWeightPoint));

    const primaryMagnitude = Math.abs(toNumber(row.primaryImpactEtf?.activeDiffLots) || row.primaryImpactEtf?.diffLots || 0);
    if (!row.primaryImpactEtf || Math.abs(activeDiffLots) > primaryMagnitude) {
      row.primaryImpactEtf = etfImpact;
    }

    rowsByStock.set(change.stockId, row);
  }

  const impacts = [...rowsByStock.values()]
    .map((row) => ({
      ...row,
      impactScore: Math.round(row.maxAbsActiveDiffLots * 100 + row.maxAbsDiffWeightPoint * 10000) / 100
    }))
    .sort((a, b) => b.impactScore - a.impactScore);

  return jsonResponse({ date, impacts });
}

app.http("getMarketStockImpact", {
  methods: ["GET"],
  route: "market/stock-impact",
  authLevel: "anonymous",
  handler: getMarketStockImpact
});
