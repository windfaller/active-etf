import { app, type InvocationContext, type Timer } from "@azure/functions";
import { runSyncDailyHoldingsJob } from "../services/jobs/dailyJobs.js";
import { logger } from "../utils/logger.js";

export async function syncDailyHoldings(_timer: Timer, _context: InvocationContext): Promise<void> {
  try {
    await runSyncDailyHoldingsJob("00981A");
  } catch (error) {
    logger.error("Source fetch or parse failed", {
      etfCode: "00981A",
      dataType: "pcf",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("syncDailyHoldings1630", {
    schedule: "0 30 16 * * 1-5",
    handler: syncDailyHoldings
  });

  app.timer("syncDailyHoldings1800", {
    schedule: "0 0 18 * * 1-5",
    handler: syncDailyHoldings
  });

  app.timer("syncDailyHoldings2100", {
    schedule: "0 0 21 * * 1-5",
    handler: syncDailyHoldings
  });
}
