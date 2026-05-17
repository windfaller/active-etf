import { getConfiguredEtf } from "../../config/etfs.js";
import { getDb } from "../../db/mongo.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import { applyActiveSignals } from "../calculator/activeSignalCalculator.js";
import { calculateDailyChanges as calculateChanges } from "../calculator/changeCalculator.js";
import { syncEzmoneyPcf } from "../sync/ezmoneyPcfSync.js";
import { todayInTaipei } from "../../utils/date.js";
import { logger } from "../../utils/logger.js";

export interface SyncDailyHoldingsJobResult {
  etfCode: string;
  tradeDate: string;
  holdings: number;
  rawSnapshotId: string;
}

export interface CalculateDailyChangesJobResult {
  etfCode: string;
  tradeDate: string;
  previousTradeDate: string;
  count: number;
}

async function latestPreviousTradeDate(etfCode: string, tradeDate: string): Promise<string | null> {
  const db = await getDb();
  const previous = await db
    .collection<EtfDailyHolding>("etf_daily_holdings")
    .find({ etfCode, tradeDate: { $lt: tradeDate } })
    .sort({ tradeDate: -1 })
    .limit(1)
    .next();

  return previous?.tradeDate ?? null;
}

export async function runSyncDailyHoldingsJob(etfCode = "00981A"): Promise<SyncDailyHoldingsJobResult> {
  const etf = getConfiguredEtf(etfCode);
  if (!etf) throw new Error(`${etfCode} is not configured`);

  const db = await getDb();
  const result = await syncEzmoneyPcf(db, etf);

  logger.info("Daily holdings synced", {
    etfCode: etf.etfCode,
    tradeDate: result.tradeDate,
    holdings: result.holdingsCount,
    rawSnapshotId: result.snapshotId
  });

  return {
    etfCode: etf.etfCode,
    tradeDate: result.tradeDate,
    holdings: result.holdingsCount,
    rawSnapshotId: result.snapshotId
  };
}

export async function runCalculateDailyChangesJob(
  etfCode = "00981A",
  requestedTradeDate?: string
): Promise<CalculateDailyChangesJobResult | null> {
  const etf = getConfiguredEtf(etfCode);
  if (!etf) throw new Error(`${etfCode} is not configured`);

  const db = await getDb();
  const tradeDate = requestedTradeDate ?? todayInTaipei();
  const prevTradeDate = await latestPreviousTradeDate(etf.etfCode, tradeDate);

  if (!prevTradeDate) {
    logger.warn("No previous trade date found; skipping changes", { etfCode: etf.etfCode, tradeDate });
    return null;
  }

  const [currentHoldings, previousHoldings, currentSummary, previousSummary] = await Promise.all([
    db.collection<EtfDailyHolding>("etf_daily_holdings").find({ etfCode: etf.etfCode, tradeDate }).toArray(),
    db
      .collection<EtfDailyHolding>("etf_daily_holdings")
      .find({ etfCode: etf.etfCode, tradeDate: prevTradeDate })
      .toArray(),
    db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode: etf.etfCode, tradeDate }),
    db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode: etf.etfCode, tradeDate: prevTradeDate })
  ]);

  if (!currentHoldings.length) {
    logger.warn("No current holdings found; skipping changes", { etfCode: etf.etfCode, tradeDate });
    return null;
  }

  const changes = applyActiveSignals(
    calculateChanges({
      etfCode: etf.etfCode,
      tradeDate,
      currentHoldings,
      previousHoldings,
      prevTotalUnits: previousSummary?.totalUnits ?? null,
      currentTotalUnits: currentSummary?.totalUnits ?? null
    })
  );

  await Promise.all(
    changes.map((change) => {
      const { createdAt, ...updateFields } = change;
      return db.collection<EtfHoldingChange>("etf_holding_changes").updateOne(
        { etfCode: change.etfCode, tradeDate: change.tradeDate, stockId: change.stockId },
        { $set: updateFields, $setOnInsert: { createdAt } },
        { upsert: true }
      );
    })
  );

  logger.info("Daily changes calculated", { etfCode: etf.etfCode, tradeDate, count: changes.length });

  return {
    etfCode: etf.etfCode,
    tradeDate,
    previousTradeDate: prevTradeDate,
    count: changes.length
  };
}
