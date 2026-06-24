import { app, type InvocationContext, type Timer } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { syncAllGlobalEtfHoldings } from "../services/globalEtf/globalEtfService.js";
import { logger } from "../utils/logger.js";

export async function syncGlobalEtfHoldings(_timer: Timer, _context: InvocationContext): Promise<void> {
  const db = await getDb();
  const results = await syncAllGlobalEtfHoldings(db);
  const failed = results.filter((result) => !result.ok);

  if (failed.length) {
    logger.error("Global ETF holdings sync completed with failures", {
      failed: failed.map((result) => ({ etfCode: result.etfCode, error: result.error }))
    });
    return;
  }

  logger.info("Global ETF holdings synced", {
    count: results.length,
    changed: results.filter((result) => result.result?.changed).map((result) => result.etfCode)
  });
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("syncGlobalEtfHoldings0700", {
    schedule: "0 0 7 * * 1-5",
    handler: syncGlobalEtfHoldings
  });

  app.timer("syncGlobalEtfHoldings2130", {
    schedule: "0 30 21 * * 1-5",
    handler: syncGlobalEtfHoldings
  });
}
