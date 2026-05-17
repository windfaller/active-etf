import type { Db } from "mongodb";
import type { EtfMaster } from "../../models/EtfMaster.js";
import { round } from "../../utils/number.js";
import { parseTwseStockDayClosingPrice } from "../parser/twseStockDayParser.js";
import { TwseClient } from "../source/twseClient.js";
import { createRawSnapshot, saveRawSnapshot } from "../source/rawSnapshotService.js";

export interface SyncTwseClosingPriceResult {
  etfCode: string;
  tradeDate: string;
  marketPrice: number;
  premiumDiscount: number | null;
  rawSnapshotId: string;
}

export async function syncTwseClosingPrice(
  db: Db,
  etf: EtfMaster,
  tradeDate: string,
  nav: number | null
): Promise<SyncTwseClosingPriceResult> {
  const client = new TwseClient();
  const fetchResult = await client.fetchStockDay(etf.etfCode, tradeDate);
  const snapshot = createRawSnapshot({
    source: "twse",
    etfCode: etf.etfCode,
    fundCode: etf.fundCode,
    dataType: "api_response",
    tradeDate,
    fetchResult
  });

  let closingPrice;
  try {
    closingPrice = parseTwseStockDayClosingPrice(snapshot.rawBody, tradeDate);
  } catch (error) {
    snapshot.parsedOk = false;
    snapshot.parseError = error instanceof Error ? error.message : String(error);
    await saveRawSnapshot(db, snapshot);
    throw error;
  }

  const premiumDiscount =
    nav !== null && nav !== 0 ? round(((closingPrice.closePrice - nav) / nav) * 100) : null;

  snapshot.parsedOk = true;
  await saveRawSnapshot(db, snapshot);

  await db.collection("etf_daily_summary").updateOne(
    { etfCode: etf.etfCode, tradeDate },
    {
      $set: {
        marketPrice: closingPrice.closePrice,
        premiumDiscount,
        updatedAt: new Date()
      }
    }
  );

  return {
    etfCode: etf.etfCode,
    tradeDate,
    marketPrice: closingPrice.closePrice,
    premiumDiscount,
    rawSnapshotId: snapshot.snapshotId
  };
}
