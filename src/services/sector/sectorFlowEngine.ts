import type { Db } from "mongodb";
import type { EtfSectorFlow, SectorName } from "../../models/EtfSectorFlow.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import { round } from "../../utils/number.js";
import { sectorForStock } from "./sectorMapping.js";

export function buildSectorFlowRows(changes: EtfHoldingChange[], tradeDate: string): EtfSectorFlow[] {
  const now = new Date();
  const rowsBySector = new Map<SectorName, EtfSectorFlow>();
  const etfsBySector = new Map<SectorName, Set<string>>();

  for (const change of changes) {
    const activeDiffLots = change.activeDiffLots ?? change.diffLots;
    if (activeDiffLots === 0) continue;

    const sector = sectorForStock(change.stockId);
    const row =
      rowsBySector.get(sector) ??
      ({
        tradeDate,
        sector,
        stockCount: 0,
        etfCount: 0,
        totalActiveDiffLots: 0,
        totalDiffWeightPoint: 0,
        flowScore: 0,
        stocks: [],
        createdAt: now,
        updatedAt: now
      } satisfies EtfSectorFlow);
    const etfSet = etfsBySector.get(sector) ?? new Set<string>();

    etfSet.add(change.etfCode);
    row.totalActiveDiffLots = round(row.totalActiveDiffLots + activeDiffLots);
    row.totalDiffWeightPoint = round(row.totalDiffWeightPoint + (change.diffWeightPoint ?? 0));
    row.stocks.push({
      stockId: change.stockId,
      stockName: change.stockName,
      totalActiveDiffLots: activeDiffLots,
      totalDiffWeightPoint: change.diffWeightPoint ?? 0
    });
    row.stockCount = row.stocks.length;
    row.etfCount = etfSet.size;

    rowsBySector.set(sector, row);
    etfsBySector.set(sector, etfSet);
  }

  return [...rowsBySector.values()]
    .map((row) => ({
      ...row,
      flowScore:
        Math.round(
          (row.etfCount * 100 + Math.abs(row.totalDiffWeightPoint) * 100 + Math.log10(Math.abs(row.totalActiveDiffLots) + 1) * 20) *
            100
        ) / 100
    }))
    .sort((a, b) => b.flowScore - a.flowScore);
}

export async function calculateSectorFlow(db: Db, tradeDate: string): Promise<EtfSectorFlow[]> {
  const changes = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({ tradeDate, activeDiffLots: { $ne: null } })
    .toArray();
  const rows = buildSectorFlowRows(changes, tradeDate);

  await Promise.all(
    rows.map((row) => {
      const { createdAt, ...updateFields } = row;
      return db.collection<EtfSectorFlow>("etf_sector_flow").updateOne(
        { tradeDate: row.tradeDate, sector: row.sector },
        { $set: updateFields, $setOnInsert: { createdAt } },
        { upsert: true }
      );
    })
  );

  return rows;
}
