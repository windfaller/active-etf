import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("etf_master").createIndex({ etfCode: 1 }, { unique: true }),
    db.collection("raw_snapshots").createIndex({ snapshotId: 1 }, { unique: true }),
    db.collection("raw_snapshots").createIndex({ etfCode: 1, dataType: 1, fetchedAt: -1 }),
    db.collection("etf_daily_holdings").createIndex(
      { etfCode: 1, tradeDate: 1, stockId: 1 },
      { unique: true }
    ),
    db.collection("etf_daily_summary").createIndex(
      { etfCode: 1, tradeDate: 1 },
      { unique: true }
    ),
    db.collection("etf_holding_changes").createIndex(
      { etfCode: 1, tradeDate: 1, stockId: 1 },
      { unique: true }
    )
  ]);
}
