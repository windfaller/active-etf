import { app, type InvocationContext, type Timer } from "@azure/functions";
import { getConfiguredEtf } from "../config/etfs.js";
import { getDb } from "../db/mongo.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { TelegramService } from "../services/notify/telegramService.js";
import { todayInTaipei } from "../utils/date.js";

export async function sendDailyDigest(_timer: Timer, _context: InvocationContext): Promise<void> {
  const etf = getConfiguredEtf("00981A");
  if (!etf) throw new Error("00981A is not configured");

  const db = await getDb();
  const tradeDate = todayInTaipei();
  const changes = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .find({ etfCode: etf.etfCode, tradeDate })
    .toArray();

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
    newHoldings: changes.filter((change) => change.status === "new" || (change.prevShares === 0 && change.currentShares > 0)),
    exitedHoldings: changes.filter(
      (change) => change.status === "exit" || (change.prevShares > 0 && change.currentShares === 0)
    )
  });
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("sendDailyDigest", {
    schedule: "0 5 21 * * 1-5",
    handler: sendDailyDigest
  });
}
