import type { AnyBulkWriteOperation, Db } from "mongodb";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { StockDailyMarket } from "../../models/StockDailyMarket.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import { sectorProfileForStock } from "./sectorMapping.js";

export interface SectorProfileRefreshResult {
  marketTradeDate: string | null;
  holdingTradeDate: string | null;
  marketRows: number;
  holdingRows: number;
  profileCount: number;
}

async function latestTradeDate(db: Db, collectionName: "stock_daily_market" | "etf_daily_holdings"): Promise<string | null> {
  const row = await db.collection(collectionName).find({}, { projection: { _id: 0, tradeDate: 1 } }).sort({ tradeDate: -1 }).limit(1).next();
  return row?.tradeDate ?? null;
}

export async function refreshStockSectorProfiles(db: Db): Promise<SectorProfileRefreshResult> {
  const [marketTradeDate, holdingTradeDate] = await Promise.all([
    latestTradeDate(db, "stock_daily_market"),
    latestTradeDate(db, "etf_daily_holdings")
  ]);
  const [marketRows, holdingRows] = await Promise.all([
    marketTradeDate
      ? db
          .collection<StockDailyMarket>("stock_daily_market")
          .find({ tradeDate: marketTradeDate }, { projection: { _id: 0, stockId: 1, stockName: 1 } })
          .toArray()
      : [],
    holdingTradeDate
      ? db
          .collection<EtfDailyHolding>("etf_daily_holdings")
          .find({ tradeDate: holdingTradeDate }, { projection: { _id: 0, stockId: 1, stockName: 1 } })
          .toArray()
      : []
  ]);

  const profileInputs = new Map<string, { stockId: string; stockName?: string }>();
  for (const row of [...marketRows, ...holdingRows]) {
    if (!profileInputs.has(row.stockId)) {
      profileInputs.set(row.stockId, { stockId: row.stockId, stockName: row.stockName });
    }
  }

  const now = new Date();
  const operations: Array<AnyBulkWriteOperation<StockSectorProfile>> = [...profileInputs.values()].map((input) => {
    const profile = sectorProfileForStock(input.stockId, input.stockName);
    return {
      updateOne: {
        filter: { stockId: profile.stockId },
        update: {
          $set: {
            stockName: profile.stockName,
            sector: profile.sector,
            themeTags: profile.themeTags,
            source: profile.source,
            updatedAt: now
          },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    };
  });

  if (operations.length) {
    await db.collection<StockSectorProfile>("stock_sector_profiles").bulkWrite(operations, { ordered: false });
  }

  return {
    marketTradeDate,
    holdingTradeDate,
    marketRows: marketRows.length,
    holdingRows: holdingRows.length,
    profileCount: profileInputs.size
  };
}
