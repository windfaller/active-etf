import type { HttpRequest } from '@azure/functions';
import { afterEach, expect, it, vi } from 'vitest';
const sender = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/auth/registrationMeta.js', () => ({ sendDueRegistrationEvents: sender }));
import { postRegistrationMeta } from '../../src/api/postEtfAdminJobs.js';
afterEach(() => { vi.unstubAllEnvs(); sender.mockReset(); });
const request = (token = '') => new Request('https://active-etf.inthewins.com/api/jobs/registration-meta/send', { method: 'POST', headers: { 'x-admin-token': token } }) as unknown as HttpRequest;
it('requires the existing admin job token before any outbox work', async () => {
  vi.stubEnv('ADMIN_JOB_TOKEN', 'fixture-admin');
  expect((await postRegistrationMeta(request())).status).toBe(401); expect(sender).not.toHaveBeenCalled();
});
it('returns only sender counters and an explicit enablement status', async () => {
  vi.stubEnv('ADMIN_JOB_TOKEN', 'fixture-admin'); vi.stubEnv('ACTIVE_ETF_CAPI_ENABLED', 'false');
  sender.mockResolvedValue({ sent: 0, failed: 0 });
  const response = await postRegistrationMeta(request('fixture-admin'));
  expect(response.jsonBody).toEqual({ ok: true, job: 'registrationMeta', enabled: false, result: { sent: 0, failed: 0 } });
  expect(JSON.stringify(response.jsonBody)).not.toContain('fixture-admin');
});
