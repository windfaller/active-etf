import { createHash, randomUUID } from "node:crypto";
import { getDb } from "../../db/mongo.js";

export const fingerprint = (value: string): string => createHash("sha256").update(value).digest("hex");
export interface AuthFlow {
  _id: string; binding: string; returnUrl: string; createdAt: Date; expiresAt: Date;
  trackingAllowed: boolean; metaUserData: { fbp?: string; fbc?: string };
  status: "pending" | "processing" | "complete" | "failed" | "cancelled";
  subject?: string; loginEventId?: string; registrationEventId?: string; receiptClaimed?: boolean;
}
export interface RegistrationEvent {
  _id: string; eventId: string; eventName: "active_etf_sign_up_success"; scope: "shared_account_created";
  occurredAt: Date; sourceUrl: string; metaUserData: AuthFlow["metaUserData"];
  browserClaimed: boolean; metaStatus: "disabled" | "no_matching_data" | "awaiting_consent" | "pending" | "sent" | "failed";
  attempts: number; nextAttemptAt: Date; leaseUntil?: Date; lease?: string;
}
let indexes: Promise<void> | null = null;
async function collections() {
  const db = await getDb();
  const flows = db.collection<AuthFlow>("active_etf_auth_flows");
  const events = db.collection<RegistrationEvent>("active_etf_registration_events");
  indexes ??= flows.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).then(() => undefined).catch(error => { indexes = null; throw error; });
  await indexes;
  return { flows, events };
}
export const authFlowStore = {
  async create(flow: AuthFlow) { await (await collections()).flows.insertOne(flow); },
  async get(id: string) { return (await collections()).flows.findOne({ _id: id, expiresAt: { $gt: new Date() } }); },
  async claim(id: string, binding: string) { return (await collections()).flows.findOneAndUpdate({ _id: id, binding, status: "pending", expiresAt: { $gt: new Date() } }, { $set: { status: "processing" } }, { returnDocument: "after" }); },
  async finish(id: string, fields: Partial<AuthFlow>) { await (await collections()).flows.updateOne({ _id: id, status: "processing" }, { $set: fields }); },
  async register(subject: string, flow: AuthFlow, occurredAt: number): Promise<string> {
    const { events } = await collections();
    const metaEnabled = process.env.ACTIVE_ETF_CAPI_ENABLED === "true";
    const record: RegistrationEvent = { _id: subject, eventId: randomUUID(), eventName: "active_etf_sign_up_success", scope: "shared_account_created", occurredAt: new Date(occurredAt), sourceUrl: new URL(new URL(flow.returnUrl).pathname, new URL(flow.returnUrl).origin).toString(), metaUserData: flow.metaUserData, browserClaimed: false, metaStatus: !metaEnabled ? "disabled" : Object.keys(flow.metaUserData).length ? "awaiting_consent" : "no_matching_data", attempts: 0, nextAttemptAt: new Date() };
    try { await events.updateOne({ _id: subject }, { $setOnInsert: record }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; } // Concurrent upsert must reuse the winner's ID.
    return (await events.findOne({ _id: subject }))!.eventId;
  },
  async receipt(id: string, subject: string, trackingAllowed = false) {
    const { flows, events } = await collections();
    const flow = await flows.findOneAndUpdate({ _id: id, subject, status: "complete", receiptClaimed: { $ne: true }, expiresAt: { $gt: new Date() } }, { $set: { receiptClaimed: true, metaUserData: {} } }, { returnDocument: "after" });
    if (!flow) return null;
    const filter = { _id: subject, eventId: flow.registrationEventId, browserClaimed: false };
    let event: RegistrationEvent | null = null;
    if (flow.registrationEventId) {
      if (!trackingAllowed) event = await events.findOneAndUpdate(filter, { $set: { browserClaimed: true, metaStatus: 'disabled', metaUserData: {} } }, { returnDocument: 'after' });
      else {
        event = await events.findOneAndUpdate({ ...filter, metaStatus: 'awaiting_consent' }, { $set: { browserClaimed: true, metaStatus: 'pending' } }, { returnDocument: 'after' });
        event ??= await events.findOneAndUpdate(filter, { $set: { browserClaimed: true } }, { returnDocument: 'after' });
      }
    }
    return { loginEventId: flow.loginEventId, ...(event && trackingAllowed ? { registration: { eventName: event.eventName, eventId: event.eventId, scope: event.scope } } : {}) };
  }
};
