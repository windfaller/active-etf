import { app, type InvocationContext, type Timer } from "@azure/functions";
import { runCalculateDailyChangesJob } from "../services/jobs/dailyJobs.js";

export async function calculateDailyChanges(_timer: Timer, _context: InvocationContext): Promise<void> {
  await runCalculateDailyChangesJob("00981A");
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("calculateDailyChanges", {
    schedule: "0 3 21 * * 1-5",
    handler: calculateDailyChanges
  });
}
