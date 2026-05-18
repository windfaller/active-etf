import { app, type InvocationContext, type Timer } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { runCalculateDailyChangesJob } from "../services/jobs/dailyJobs.js";
import { logger } from "../utils/logger.js";

export async function calculateDailyChanges(_timer: Timer, _context: InvocationContext): Promise<void> {
  const enabledEtfs = configuredEtfs.filter((etf) => etf.enabled);

  for (const etf of enabledEtfs) {
    try {
      await runCalculateDailyChangesJob(etf.etfCode);
    } catch (error) {
      logger.error("Daily changes calculation failed", {
        etfCode: etf.etfCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("calculateDailyChanges", {
    schedule: "0 3 21 * * 1-5",
    handler: calculateDailyChanges
  });
}
