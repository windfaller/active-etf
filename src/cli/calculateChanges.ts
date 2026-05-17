import "dotenv/config";
import { getConfiguredEtf } from "../config/etfs.js";
import { closeDb, getDb } from "../db/mongo.js";
import type { EtfDailyHolding } from "../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { applyActiveSignals } from "../services/calculator/activeSignalCalculator.js";
import { calculateDailyChanges } from "../services/calculator/changeCalculator.js";

const etfCode = process.argv[2] ?? "00981A";
const requestedDate = process.argv[3];
const etf = getConfiguredEtf(etfCode);

if (!etf) {
  throw new Error(`ETF is not configured: ${etfCode}`);
}

const db = await getDb();

const latestHolding = requestedDate
  ? { tradeDate: requestedDate }
  : await db
      .collection<EtfDailyHolding>("etf_daily_holdings")
      .find({ etfCode: etf.etfCode })
      .sort({ tradeDate: -1 })
      .limit(1)
      .next();

if (!latestHolding?.tradeDate) {
  throw new Error(`No holdings found for ${etf.etfCode}`);
}

const tradeDate = latestHolding.tradeDate;
const previousHolding = await db
  .collection<EtfDailyHolding>("etf_daily_holdings")
  .find({ etfCode: etf.etfCode, tradeDate: { $lt: tradeDate } })
  .sort({ tradeDate: -1 })
  .limit(1)
  .next();

if (!previousHolding?.tradeDate) {
  throw new Error(`No previous holdings found for ${etf.etfCode} before ${tradeDate}`);
}

const prevTradeDate = previousHolding.tradeDate;
const [currentHoldings, previousHoldings, currentSummary, previousSummary] = await Promise.all([
  db.collection<EtfDailyHolding>("etf_daily_holdings").find({ etfCode: etf.etfCode, tradeDate }).toArray(),
  db
    .collection<EtfDailyHolding>("etf_daily_holdings")
    .find({ etfCode: etf.etfCode, tradeDate: prevTradeDate })
    .toArray(),
  db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode: etf.etfCode, tradeDate }),
  db.collection<EtfDailySummary>("etf_daily_summary").findOne({ etfCode: etf.etfCode, tradeDate: prevTradeDate })
]);

const changes = applyActiveSignals(
  calculateDailyChanges({
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

const topActive = changes
  .filter((change) => (change.activeDiffShares ?? 0) > 0)
  .sort((a, b) => (b.activeDiffShares ?? 0) - (a.activeDiffShares ?? 0))
  .slice(0, 5);

console.log(`calculated changes ${etf.etfCode} ${tradeDate} vs ${prevTradeDate}: ${changes.length}`);
for (const change of topActive) {
  console.log(
    `${change.stockId} ${change.stockName} activeDiffLots=${change.activeDiffLots} diffLots=${change.diffLots} score=${change.activeSignalScore}`
  );
}

await closeDb();
