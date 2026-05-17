import "dotenv/config";
import { getConfiguredEtf } from "../config/etfs.js";
import { closeDb, getDb } from "../db/mongo.js";
import { syncEzmoneyPcf } from "../services/sync/ezmoneyPcfSync.js";

const etfCode = process.argv[2] ?? "00981A";
const etf = getConfiguredEtf(etfCode);

if (!etf) {
  throw new Error(`ETF is not configured: ${etfCode}`);
}

const db = await getDb();
const result = await syncEzmoneyPcf(db, etf);

console.log(`saved pcf snapshot ${result.snapshotId}`);
console.log(`upserted summary ${result.tradeDate}`);
console.log(`upserted holdings ${result.holdingsCount}`);
await closeDb();
