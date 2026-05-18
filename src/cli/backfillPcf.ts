import "dotenv/config";
import { getConfiguredEtf } from "../config/etfs.js";
import { closeDb, getDb } from "../db/mongo.js";
import { runCalculateDailyChangesJob } from "../services/jobs/dailyJobs.js";
import { syncEzmoneyPcf } from "../services/sync/ezmoneyPcfSync.js";
import { syncProviderDailyData } from "../services/sync/providerDailyDataSync.js";
import { addDaysIsoDate, isoDateToRocDate, todayInTaipei } from "../utils/date.js";

const etfCode = process.argv[2] ?? "00981A";
const days = Number(process.argv[3] ?? 10);
const startDate = process.argv[4] ?? todayInTaipei();
const etf = getConfiguredEtf(etfCode);

if (!etf) {
  throw new Error(`ETF is not configured: ${etfCode}`);
}

if (!Number.isInteger(days) || days <= 0) {
  throw new Error(`days must be a positive integer, got: ${process.argv[3]}`);
}

const db = await getDb();
const seenTradeDates = new Set<string>();

for (let offset = 0; offset < days; offset += 1) {
  const queryIsoDate = addDaysIsoDate(startDate, -offset);
  const queryDate = etf.source.providerId ? queryIsoDate : isoDateToRocDate(queryIsoDate);

  try {
    const result = etf.source.providerId
      ? await syncProviderDailyData(db, etf, { queryDate })
      : await syncEzmoneyPcf(db, etf, {
          queryDate,
          specificDate: true
        });
    const duplicate = seenTradeDates.has(result.tradeDate);
    seenTradeDates.add(result.tradeDate);

    console.log(
      [
        `query=${queryDate}`,
        `tradeDate=${result.tradeDate}`,
        `holdings=${result.holdingsCount}`,
        `snapshot=${result.snapshotId}`,
        duplicate ? "duplicate=true" : "duplicate=false"
      ].join(" ")
    );
  } catch (error) {
    console.error(
      `query=${queryDate} failed=${error instanceof Error ? error.message : String(error)}`
    );
  }
}

for (const tradeDate of [...seenTradeDates].sort()) {
  const changeResult = await runCalculateDailyChangesJob(etf.etfCode, tradeDate);
  console.log(`calculate tradeDate=${tradeDate} changes=${changeResult?.count ?? 0}`);
}

await closeDb();
