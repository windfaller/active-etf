import { app, type InvocationContext, type Timer } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { sendTelegramDailyDigest } from "../services/notify/dailyDigestJob.js";
import { todayInTaipei } from "../utils/date.js";

export async function sendDailyDigest(_timer: Timer, _context: InvocationContext): Promise<void> {
  const db = await getDb();
  await sendTelegramDailyDigest(db, { tradeDate: todayInTaipei() });
}

if (process.env.ENABLE_TIMER_TRIGGERS === "true") {
  app.timer("sendDailyDigest", {
    schedule: "0 5 21 * * 1-5",
    handler: sendDailyDigest
  });
}
