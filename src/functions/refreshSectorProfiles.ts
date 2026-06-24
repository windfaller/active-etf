import { app, type InvocationContext, type Timer } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { refreshStockSectorProfiles } from "../services/sector/sectorProfileSync.js";
import { logger } from "../utils/logger.js";

export async function refreshSectorProfiles(_timer: Timer, _context: InvocationContext): Promise<void> {
  const db = await getDb();
  const result = await refreshStockSectorProfiles(db);
  logger.info("Stock sector profiles refreshed", { ...result });
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("refreshSectorProfiles", {
    schedule: "0 0 7 * * 1",
    handler: refreshSectorProfiles
  });
}
