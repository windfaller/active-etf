import { app, type InvocationContext, type Timer } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { ensureIndexes } from "../db/indexes.js";
import { getDb } from "../db/mongo.js";
import type { EtfMaster } from "../models/EtfMaster.js";
import { logger } from "../utils/logger.js";

export async function syncEtfMaster(_timer: Timer, _context: InvocationContext): Promise<void> {
  const db = await getDb();
  await ensureIndexes(db);

  for (const etf of configuredEtfs) {
    const { createdAt: _createdAt, ...updateFields } = etf;

    await db.collection<EtfMaster>("etf_master").updateOne(
      { etfCode: etf.etfCode },
      {
        $set: {
          ...updateFields,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  logger.info("ETF master synced", { count: configuredEtfs.length });
}

app.timer("syncEtfMaster", {
  schedule: "0 30 8 * * *",
  handler: syncEtfMaster
});
