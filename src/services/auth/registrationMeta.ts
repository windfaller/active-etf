import { randomUUID } from "node:crypto";
import { getDb } from "../../db/mongo.js";
import type { RegistrationEvent } from "./flowStore.js";

export const ETF_PIXEL_ID = "1811635619849853";
export function registrationMetaPayload(event: RegistrationEvent) {
  return { data: [{ event_name: event.eventName, event_id: event.eventId, event_time: Math.floor(event.occurredAt.getTime() / 1000), action_source: "website", event_source_url: event.sourceUrl, user_data: event.metaUserData, custom_data: { registration_scope: event.scope } }] };
}
/** Opt-in only. Previously disabled events are never backfilled by enabling this worker. */
export async function sendDueRegistrationEvents(): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  const token = process.env.ACTIVE_ETF_META_ACCESS_TOKEN;
  const version = process.env.ACTIVE_ETF_META_API_VERSION;
  if (process.env.ACTIVE_ETF_CAPI_ENABLED !== "true" || !token || !/^v\d+\.\d+$/u.test(version ?? "")) return result;
  const events = (await getDb()).collection<RegistrationEvent>("active_etf_registration_events");
  for (let index = 0; index < 10; index += 1) {
    const now = new Date(); const lease = randomUUID();
    const event = await events.findOneAndUpdate({ metaStatus: "pending", nextAttemptAt: { $lte: now }, occurredAt: { $gt: new Date(Date.now() - 7 * 86400000) }, attempts: { $lt: 5 }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }] }, { $set: { lease, leaseUntil: new Date(Date.now() + 60_000) }, $inc: { attempts: 1 } }, { returnDocument: "after" });
    if (!event) break;
    let accepted = false;
    try {
      const payload = { ...registrationMetaPayload(event), ...(process.env.ACTIVE_ETF_META_TEST_EVENT_CODE ? { test_event_code: process.env.ACTIVE_ETF_META_TEST_EVENT_CODE } : {}) };
      const response = await fetch(`https://graph.facebook.com/${version}/${ETF_PIXEL_ID}/events`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
      const receipt = await response.json() as { events_received?: number };
      accepted = response.ok && receipt.events_received === 1;
    } catch { /* Only statuses are persisted. Never log response/user data or credentials. */ }
    await events.updateOne({ _id: event._id, lease }, { $set: { metaStatus: accepted ? "sent" : event.attempts >= 5 ? "failed" : "pending", nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** event.attempts) * 1000) }, $unset: { lease: "", leaseUntil: "" } });
    if (accepted) result.sent += 1; else result.failed += 1;
  }
  return result;
}
