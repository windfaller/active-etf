import { app, type InvocationContext, type Timer } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { runActiveEtfDiscovery } from "../services/discovery/activeEtfDiscoveryService.js";
import { logger } from "../utils/logger.js";

export async function discoverActiveEtfs(_timer: Timer, _context: InvocationContext): Promise<void> {
  const db = await getDb();
  const result = await runActiveEtfDiscovery(db, { notify: true });
  logger.info("Active ETF discovery completed", {
    totalOfficialActiveEtfs: result.totalOfficialActiveEtfs,
    trackedCount: result.trackedCount,
    untrackedCount: result.untrackedCount,
    newlyDetected: result.newlyDetected.length,
    notification: result.notification
  });
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("discoverActiveEtfs", {
    schedule: "0 0 9,17 * * *",
    handler: discoverActiveEtfs
  });
}
