import type { Db } from "mongodb";
import type { EtfMaster } from "../../models/EtfMaster.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import { parseEzmoneyHoldings } from "../parser/ezmoneyHoldingParser.js";
import { detectEzmoneyPcfTradeDate, parseEzmoneyPcf } from "../parser/ezmoneyPcfParser.js";
import { EzmoneyClient } from "../source/ezmoneyClient.js";
import { createRawSnapshot, saveRawSnapshot } from "../source/rawSnapshotService.js";

export interface SyncEzmoneyPcfOptions {
  queryDate?: string;
  specificDate?: boolean;
}

export interface SyncEzmoneyPcfResult {
  snapshotId: string;
  tradeDate: string;
  holdingsCount: number;
}

export async function syncEzmoneyPcf(
  db: Db,
  etf: EtfMaster,
  options: SyncEzmoneyPcfOptions = {}
): Promise<SyncEzmoneyPcfResult> {
  const client = new EzmoneyClient();
  const fetchResult = await client.fetchPcfJson(etf, options.queryDate, options.specificDate ?? false);
  const tradeDate = detectEzmoneyPcfTradeDate(fetchResult.rawBody);
  const snapshot = createRawSnapshot({
    source: "ezmoney",
    etfCode: etf.etfCode,
    fundCode: etf.fundCode,
    dataType: "pcf",
    tradeDate,
    fetchResult
  });
  let summary: EtfDailySummary;
  let holdings: EtfDailyHolding[];

  try {
    summary = parseEzmoneyPcf({
      etfCode: etf.etfCode,
      tradeDate,
      rawSnapshotId: snapshot.snapshotId,
      rawBody: snapshot.rawBody,
      contentType: snapshot.rawContentType
    });
    holdings = parseEzmoneyHoldings({
      etfCode: etf.etfCode,
      tradeDate,
      rawSnapshotId: snapshot.snapshotId,
      rawBody: snapshot.rawBody,
      contentType: snapshot.rawContentType
    });
  } catch (error) {
    snapshot.parsedOk = false;
    snapshot.parseError = error instanceof Error ? error.message : String(error);
    await saveRawSnapshot(db, snapshot);
    throw error;
  }

  snapshot.parsedOk = true;
  await saveRawSnapshot(db, snapshot);

  const { createdAt: summaryCreatedAt, ...summaryUpdateFields } = summary;
  await db.collection<EtfDailySummary>("etf_daily_summary").updateOne(
    { etfCode: summary.etfCode, tradeDate: summary.tradeDate },
    { $set: summaryUpdateFields, $setOnInsert: { createdAt: summaryCreatedAt } },
    { upsert: true }
  );

  await Promise.all(
    holdings.map((holding) => {
      const { createdAt, ...updateFields } = holding;
      return db.collection<EtfDailyHolding>("etf_daily_holdings").updateOne(
        { etfCode: holding.etfCode, tradeDate: holding.tradeDate, stockId: holding.stockId },
        { $set: updateFields, $setOnInsert: { createdAt } },
        { upsert: true }
      );
    })
  );

  return {
    snapshotId: snapshot.snapshotId,
    tradeDate,
    holdingsCount: holdings.length
  };
}
