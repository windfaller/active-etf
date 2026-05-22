import type { Db } from "mongodb";
import { getConfiguredEtf } from "../../config/etfs.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import { TelegramService } from "./telegramService.js";

export interface TelegramDailyDigestOptions {
  etfCode?: string;
  tradeDate?: string;
}

export interface TelegramDailyDigestResult {
  etfCode: string;
  etfName: string;
  tradeDate: string;
  changeCount: number;
}

async function latestDigestTradeDate(db: Db, etfCode: string): Promise<string | null> {
  const latest = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({ etfCode })
    .sort({ tradeDate: -1 })
    .limit(1)
    .next();

  return latest?.tradeDate ?? null;
}

export async function sendTelegramDailyDigest(
  db: Db,
  options: TelegramDailyDigestOptions = {}
): Promise<TelegramDailyDigestResult> {
  const etfCode = options.etfCode ?? "00981A";
  const etf = getConfiguredEtf(etfCode);
  if (!etf) throw new Error(`${etfCode} is not configured`);

  const tradeDate = options.tradeDate ?? (await latestDigestTradeDate(db, etf.etfCode));
  if (!tradeDate) throw new Error(`No holding changes found for ${etf.etfCode}`);

  const changes = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({ etfCode: etf.etfCode, tradeDate })
    .toArray();
  if (!changes.length) throw new Error(`No holding changes found for ${etf.etfCode} on ${tradeDate}`);

  const service = new TelegramService(db);
  await service.sendDailyDigest({
    etfCode: etf.etfCode,
    etfName: etf.name,
    tradeDate,
    topActiveIncreases: changes
      .filter((change) => (change.activeDiffShares ?? 0) > 0)
      .sort((a, b) => (b.activeSignalScore ?? 0) - (a.activeSignalScore ?? 0)),
    topActiveDecreases: changes
      .filter((change) => (change.activeDiffShares ?? 0) < 0)
      .sort((a, b) => (b.activeSignalScore ?? 0) - (a.activeSignalScore ?? 0)),
    newHoldings: changes.filter(
      (change) => change.status === "new" || (change.prevShares === 0 && change.currentShares > 0)
    ),
    exitedHoldings: changes.filter(
      (change) => change.status === "exit" || (change.prevShares > 0 && change.currentShares === 0)
    )
  });

  return {
    etfCode: etf.etfCode,
    etfName: etf.name,
    tradeDate,
    changeCount: changes.length
  };
}
