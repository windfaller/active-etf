import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('../../src/db/mongo.js', () => ({ getDb: mocks.db }));
import { authFlowStore, type AuthFlow, type RegistrationEvent } from '../../src/services/auth/flowStore.js';
import { registrationMetaPayload, sendDueRegistrationEvents } from '../../src/services/auth/registrationMeta.js';
let record: RegistrationEvent | null;
let flowClaimed: boolean;
const flow: AuthFlow = { _id: 'flow', binding: 'hash', returnUrl: 'https://active-etf.inthewins.com/compare/etfs?codes=00981A,00982A&utm_source=qa', createdAt: new Date(), expiresAt: new Date(Date.now() + 60000), trackingAllowed: true, metaUserData: { fbp: 'fb.1.1700000000000.fixture' }, status: 'complete', subject: 'subject-hash', loginEventId: 'login', receiptClaimed: false };
const events = {
  updateOne: vi.fn(async (_filter, update) => {
    if (update.$setOnInsert && !record) record = { ...update.$setOnInsert };
    if (update.$set && record) Object.assign(record, update.$set);
    if (update.$unset && record) for (const key of Object.keys(update.$unset)) delete (record as any)[key];
  }),
  findOne: vi.fn(async () => record),
  findOneAndUpdate: vi.fn(async (filter, update) => {
    if (!record) return null;
    if (filter.browserClaimed === false) {
      if (record.browserClaimed || (filter.metaStatus && filter.metaStatus !== record.metaStatus)) return null;
      Object.assign(record, update.$set); return { ...record };
    }
    if (record.metaStatus !== 'pending' || record.nextAttemptAt > new Date() || record.attempts >= 5) return null;
    Object.assign(record, update.$set); record.attempts += 1;
    return { ...record };
  })
};
const flows = { createIndex: vi.fn(async () => 'expiry'), findOneAndUpdate: vi.fn(async () => {
  if (flowClaimed) return null;
  flowClaimed = true; return { ...flow, registrationEventId: record?.eventId };
}) };
beforeEach(() => { vi.clearAllMocks(); record = null; flowClaimed = false; mocks.db.mockResolvedValue({ collection: (name: string) => name === 'active_etf_auth_flows' ? flows : events }); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('one subject has one event ID across concurrent creation/retries; browser receipt claims once', async () => {
  const ids = await Promise.all([authFlowStore.register('subject-hash', flow, Date.now()), authFlowStore.register('subject-hash', flow, Date.now())]);
  expect(ids[0]).toBe(ids[1]);
  events.updateOne.mockRejectedValueOnce(Object.assign(new Error('fixture concurrent upsert'), { code: 11000 }));
  expect(await authFlowStore.register('subject-hash', flow, Date.now())).toBe(ids[0]);
  expect(record?.sourceUrl).toBe('https://active-etf.inthewins.com/compare/etfs');
  expect((await authFlowStore.receipt('flow', 'subject-hash', true))?.registration?.eventId).toBe(ids[0]);
  expect(await authFlowStore.receipt('flow', 'subject-hash', true)).toBeNull();
  flowClaimed = false; // Another callback flow for same account still cannot re-claim registration.
  expect((await authFlowStore.receipt('other-flow', 'subject-hash', true))?.registration).toBeUndefined();
  expect(record?.metaStatus).toBe('disabled');
});
it('CAPI retries reuse custom event name/ID and omit identity, query, value and currency', async () => {
  vi.stubEnv('ACTIVE_ETF_CAPI_ENABLED', 'true'); vi.stubEnv('ACTIVE_ETF_META_ACCESS_TOKEN', 'fixture'); vi.stubEnv('ACTIVE_ETF_META_API_VERSION', 'v99.0');
  const id = await authFlowStore.register('subject-hash', flow, Date.now());
  expect(record?.metaStatus).toBe('awaiting_consent');
  await authFlowStore.receipt('flow', 'subject-hash', true);
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response('{"events_received":1}'));
  vi.stubGlobal('fetch', fetcher);
  expect(await sendDueRegistrationEvents()).toEqual({ sent: 0, failed: 1 });
  record!.nextAttemptAt = new Date(0);
  expect(await sendDueRegistrationEvents()).toEqual({ sent: 1, failed: 0 });
  expect(await sendDueRegistrationEvents()).toEqual({ sent: 0, failed: 0 });
  const payloads = fetcher.mock.calls.map(call => JSON.parse(call[1].body));
  expect(payloads[0]).toEqual(payloads[1]);
  expect(payloads[0].data[0]).toMatchObject({ event_id: id, event_name: 'active_etf_sign_up_success' });
  expect(JSON.stringify(registrationMetaPayload(record!))).not.toMatch(/subject-hash|email|idToken|utm_|value|currency/u);
  expect(fetcher.mock.calls[0][0]).not.toContain('fixture');
});
it('disabled worker neither sends nor backfills existing disabled events', async () => {
  await authFlowStore.register('subject-hash', flow, Date.now());
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect(await sendDueRegistrationEvents()).toEqual({ sent: 0, failed: 0 });
  expect(fetcher).not.toHaveBeenCalled(); expect(record?.metaStatus).toBe('disabled');
});
it('a refusal on return suppresses browser and CAPI registration even if start consent was granted', async () => {
  vi.stubEnv('ACTIVE_ETF_CAPI_ENABLED', 'true');
  await authFlowStore.register('subject-hash', flow, Date.now());
  expect(record?.metaStatus).toBe('awaiting_consent');
  const receipt = await authFlowStore.receipt('flow', 'subject-hash', false);
  expect(receipt?.registration).toBeUndefined(); expect(record?.metaStatus).toBe('disabled'); expect(record?.metaUserData).toEqual({});
});
