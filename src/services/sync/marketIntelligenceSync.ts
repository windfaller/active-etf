import type { AnyBulkWriteOperation, Db } from "mongodb";
import type { RawSnapshot } from "../../models/RawSnapshot.js";
import type { StockDailyMarket } from "../../models/StockDailyMarket.js";
import type { StockInstitutionalFlow } from "../../models/StockInstitutionalFlow.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import type { SourceFetchResult } from "../source/httpClient.js";
import { logger } from "../../utils/logger.js";
import {
  parseTpexDailyMarket,
  parseTpexInstitutionalFlows,
  parseTwseDailyMarket,
  parseTwseInstitutionalFlows
} from "../parser/marketDataParser.js";
import { sectorProfileForStock } from "../sector/sectorMapping.js";
import { MarketDataClient } from "../source/marketDataClient.js";
import { createRawSnapshot, saveRawSnapshot } from "../source/rawSnapshotService.js";

export interface MarketIntelligenceSyncResult {
  tradeDate: string;
  marketRows: number;
  institutionalRows: number;
  sectorProfiles: number;
  snapshots: string[];
  errors: Array<{ source: string; error: string }>;
}

type MarketSource = {
  source: RawSnapshot["source"];
  dataKind: "market" | "institutional";
  fetch: () => Promise<SourceFetchResult>;
  parse: (rawBody: string) => StockDailyMarket[] | StockInstitutionalFlow[];
};

async function upsertMarketRows(db: Db, rows: StockDailyMarket[]): Promise<void> {
  if (!rows.length) return;

  const operations: Array<AnyBulkWriteOperation<StockDailyMarket>> = rows.map((row) => {
    const { createdAt, ...updateFields } = row;
    return {
      updateOne: {
        filter: { tradeDate: row.tradeDate, stockId: row.stockId },
        update: { $set: updateFields, $setOnInsert: { createdAt } },
        upsert: true
      }
    };
  });

  await db.collection<StockDailyMarket>("stock_daily_market").bulkWrite(operations, { ordered: false });
}

async function upsertInstitutionalRows(db: Db, rows: StockInstitutionalFlow[]): Promise<void> {
  if (!rows.length) return;

  const operations: Array<AnyBulkWriteOperation<StockInstitutionalFlow>> = rows.map((row) => {
    const { createdAt, ...updateFields } = row;
    return {
      updateOne: {
        filter: { tradeDate: row.tradeDate, stockId: row.stockId },
        update: { $set: updateFields, $setOnInsert: { createdAt } },
        upsert: true
      }
    };
  });

  await db.collection<StockInstitutionalFlow>("stock_institutional_flows").bulkWrite(operations, { ordered: false });
}

async function upsertSectorProfiles(db: Db, rows: StockDailyMarket[]): Promise<number> {
  const profiles = new Map<string, Omit<StockSectorProfile, "createdAt" | "updatedAt">>();
  for (const row of rows) {
    profiles.set(row.stockId, sectorProfileForStock(row.stockId, row.stockName));
  }

  if (!profiles.size) return 0;

  const now = new Date();
  const operations: Array<AnyBulkWriteOperation<StockSectorProfile>> = [...profiles.values()].map((profile) => ({
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
  }));

  await db.collection<StockSectorProfile>("stock_sector_profiles").bulkWrite(operations, { ordered: false });
  return profiles.size;
}

export async function syncDailyMarketIntelligence(db: Db, tradeDate: string): Promise<MarketIntelligenceSyncResult> {
  const client = new MarketDataClient();
  const result: MarketIntelligenceSyncResult = {
    tradeDate,
    marketRows: 0,
    institutionalRows: 0,
    sectorProfiles: 0,
    snapshots: [],
    errors: []
  };
  const allMarketRows: StockDailyMarket[] = [];

  const sources: MarketSource[] = [
    {
      source: "twse_market",
      dataKind: "market",
      fetch: () => client.fetchTwseDailyQuotes(tradeDate),
      parse: (rawBody) => parseTwseDailyMarket(rawBody, tradeDate)
    },
    {
      source: "tpex_market",
      dataKind: "market",
      fetch: () => client.fetchTpexDailyQuotes(tradeDate),
      parse: (rawBody) => parseTpexDailyMarket(rawBody, tradeDate)
    },
    {
      source: "twse_institutional",
      dataKind: "institutional",
      fetch: () => client.fetchTwseInstitutionalFlows(tradeDate),
      parse: (rawBody) => parseTwseInstitutionalFlows(rawBody, tradeDate)
    },
    {
      source: "tpex_institutional",
      dataKind: "institutional",
      fetch: () => client.fetchTpexInstitutionalFlows(tradeDate),
      parse: (rawBody) => parseTpexInstitutionalFlows(rawBody, tradeDate)
    }
  ];

  for (const source of sources) {
    let fetchResult: SourceFetchResult | null = null;
    const snapshotInput = {
      source: source.source,
      etfCode: "MARKET",
      dataType: "api_response" as const,
      tradeDate
    };

    try {
      fetchResult = await source.fetch();
      const snapshot = createRawSnapshot({ ...snapshotInput, fetchResult });
      const rows = source.parse(snapshot.rawBody);
      snapshot.parsedOk = true;
      await saveRawSnapshot(db, snapshot);
      result.snapshots.push(snapshot.snapshotId);

      if (source.dataKind === "market") {
        const marketRows = rows as StockDailyMarket[];
        await upsertMarketRows(db, marketRows);
        allMarketRows.push(...marketRows);
        result.marketRows += marketRows.length;
      } else {
        const institutionalRows = rows as StockInstitutionalFlow[];
        await upsertInstitutionalRows(db, institutionalRows);
        result.institutionalRows += institutionalRows.length;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (fetchResult) {
        const snapshot = createRawSnapshot({ ...snapshotInput, fetchResult, parsedOk: false, parseError: message });
        await saveRawSnapshot(db, snapshot);
        result.snapshots.push(snapshot.snapshotId);
      }
      result.errors.push({ source: source.source, error: message });
      logger.warn("Market intelligence source failed", { source: source.source, tradeDate, error: message });
    }
  }

  result.sectorProfiles = await upsertSectorProfiles(db, allMarketRows);
  logger.info("Daily market intelligence synced", { ...result });
  return result;
}
