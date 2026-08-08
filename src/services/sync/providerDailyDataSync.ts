import type { Db } from "mongodb";
import type { EtfMaster } from "../../models/EtfMaster.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import type { RawSnapshot } from "../../models/RawSnapshot.js";
import { getProvider } from "../../providers/registry.js";
import type { ProviderId, RawSummaryResponse } from "../../providers/types.js";
import { todayInTaipei } from "../../utils/date.js";
import { logger } from "../../utils/logger.js";
import { createRawSnapshot, saveRawSnapshot } from "../source/rawSnapshotService.js";
import { syncTwseClosingPrice } from "./twseClosingPriceSync.js";

export interface SyncProviderDailyDataOptions {
  queryDate?: string;
}

export interface SyncProviderDailyDataResult {
  snapshotId: string;
  tradeDate: string;
  holdingsCount: number;
}

type ProviderDailySource = Extract<
  RawSnapshot["source"],
  | "nomura"
  | "capital"
  | "yuanta"
  | "taishin"
  | "ctbc"
  | "jpmorgan"
  | "allianz"
  | "mega"
  | "fubon"
  | "kgi"
  | "allianceBernstein"
  | "first"
  | "cathay"
  | "fh"
  | "sinopac"
>;

function providerSource(providerId: ProviderId): ProviderDailySource {
  if (providerId === "nomura") return "nomura";
  if (providerId === "capital") return "capital";
  if (providerId === "yuanta") return "yuanta";
  if (providerId === "taishin") return "taishin";
  if (providerId === "ctbc") return "ctbc";
  if (providerId === "jpmorgan") return "jpmorgan";
  if (providerId === "allianz") return "allianz";
  if (providerId === "mega") return "mega";
  if (providerId === "fubon") return "fubon";
  if (providerId === "kgi") return "kgi";
  if (providerId === "allianceBernstein") return "allianceBernstein";
  if (providerId === "first") return "first";
  if (providerId === "cathay") return "cathay";
  if (providerId === "fh") return "fh";
  if (providerId === "sinopac") return "sinopac";
  throw new Error(`Provider source is not mapped for raw snapshots: ${providerId}`);
}

export async function syncProviderDailyData(
  db: Db,
  etf: EtfMaster,
  options: SyncProviderDailyDataOptions = {}
): Promise<SyncProviderDailyDataResult> {
  const providerId = etf.source.providerId as ProviderId | undefined;
  if (!providerId) {
    throw new Error(`Missing providerId for ${etf.etfCode}`);
  }

  const provider = getProvider(providerId);
  const rawHoldings = await provider.fetchDailyHoldings(etf.etfCode, options.queryDate ?? todayInTaipei());
  const snapshot = createRawSnapshot({
    source: providerSource(provider.providerId),
    etfCode: etf.etfCode,
    fundCode: etf.fundCode,
    dataType: rawHoldings.dataType,
    tradeDate: rawHoldings.tradeDate,
    fetchResult: rawHoldings.fetchResult
  });

  let summary: EtfDailySummary;
  let holdings: EtfDailyHolding[];

  try {
    const normalizedSummary = provider.normalizeSummary({
      ...rawHoldings,
      dataType: "summary"
    } satisfies RawSummaryResponse);
    const normalizedHoldings = provider.normalizeHoldings(rawHoldings);
    const now = new Date();

    summary = {
      etfCode: normalizedSummary.etfCode,
      tradeDate: normalizedSummary.tradeDate,
      nav: normalizedSummary.nav,
      marketPrice: normalizedSummary.marketPrice,
      premiumDiscount: normalizedSummary.premiumDiscount,
      totalUnits: normalizedSummary.totalUnits,
      fundSize: normalizedSummary.fundSize,
      netCreationUnits: normalizedSummary.netCreationUnits ?? null,
      cashRatio: normalizedSummary.cashRatio ?? null,
      stockRatio: normalizedSummary.stockRatio ?? null,
      source: providerSource(provider.providerId),
      rawSnapshotId: snapshot.snapshotId,
      createdAt: now,
      updatedAt: now
    };

    holdings = normalizedHoldings.map((holding) => ({
      etfCode: holding.etfCode,
      tradeDate: holding.tradeDate,
      stockId: holding.stockId,
      stockName: holding.stockName,
      shares: holding.shares,
      lots: holding.lots,
      weight: holding.weight,
      marketValue: holding.marketValue,
      source: providerSource(provider.providerId),
      rawSnapshotId: snapshot.snapshotId,
      createdAt: now,
      updatedAt: now
    }));
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

  try {
    await syncTwseClosingPrice(db, etf, summary.tradeDate, summary.nav);
  } catch (error) {
    logger.warn("Closing price sync skipped", {
      etfCode: etf.etfCode,
      tradeDate: summary.tradeDate,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    snapshotId: snapshot.snapshotId,
    tradeDate: summary.tradeDate,
    holdingsCount: holdings.length
  };
}
