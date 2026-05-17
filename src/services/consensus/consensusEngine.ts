import type { Db } from "mongodb";
import type { EtfConsensus } from "../../models/EtfConsensus.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import { round } from "../../utils/number.js";

export function buildConsensusRows(changes: EtfHoldingChange[], tradeDate: string): EtfConsensus[] {
  const rowsByStock = new Map<string, EtfConsensus>();
  const now = new Date();

  for (const change of changes) {
    const activeDiffLots = change.activeDiffLots ?? change.diffLots;
    if (activeDiffLots === 0) continue;

    const row =
      rowsByStock.get(change.stockId) ??
      ({
        tradeDate,
        stockId: change.stockId,
        stockName: change.stockName,
        etfCount: 0,
        increaseEtfCount: 0,
        decreaseEtfCount: 0,
        totalActiveDiffLots: 0,
        totalDiffWeightPoint: 0,
        consensusScore: 0,
        etfs: [],
        createdAt: now,
        updatedAt: now
      } satisfies EtfConsensus);

    row.etfCount += 1;
    row.increaseEtfCount += activeDiffLots > 0 ? 1 : 0;
    row.decreaseEtfCount += activeDiffLots < 0 ? 1 : 0;
    row.totalActiveDiffLots = round(row.totalActiveDiffLots + activeDiffLots);
    row.totalDiffWeightPoint = round(row.totalDiffWeightPoint + (change.diffWeightPoint ?? 0));
    row.etfs.push({
      etfCode: change.etfCode,
      activeDiffLots: change.activeDiffLots,
      diffWeightPoint: change.diffWeightPoint,
      currentWeight: change.currentWeight
    });

    rowsByStock.set(change.stockId, row);
  }

  return [...rowsByStock.values()]
    .map((row) => ({
      ...row,
      consensusScore:
        Math.round(
          (Math.max(row.increaseEtfCount, row.decreaseEtfCount) * 100 +
            Math.abs(row.totalDiffWeightPoint) * 100 +
            Math.log10(Math.abs(row.totalActiveDiffLots) + 1) * 20) *
            100
        ) / 100
    }))
    .sort((a, b) => b.consensusScore - a.consensusScore);
}

export async function calculateConsensus(db: Db, tradeDate: string): Promise<EtfConsensus[]> {
  const changes = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({ tradeDate, activeDiffLots: { $ne: null } })
    .toArray();
  const rows = buildConsensusRows(changes, tradeDate);

  await Promise.all(
    rows.map((row) => {
      const { createdAt, ...updateFields } = row;
      return db.collection<EtfConsensus>("etf_consensus").updateOne(
        { tradeDate: row.tradeDate, stockId: row.stockId },
        { $set: updateFields, $setOnInsert: { createdAt } },
        { upsert: true }
      );
    })
  );

  return rows;
}
