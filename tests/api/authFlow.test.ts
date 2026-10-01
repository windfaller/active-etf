import type { HttpRequest } from '@azure/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), claim: vi.fn(), finish: vi.fn(), register: vi.fn(), verify: vi.fn(), lookup: vi.fn(), capability: vi.fn() }));
vi.mock('../../src/services/auth/authCapability.js', () => ({ supportsEtfPostReturn: mocks.capability }));
vi.mock('../../src/services/auth/flowStore.js', async original => ({ ...await original<typeof import('../../src/services/auth/flowStore.js')>(), authFlowStore: mocks }));
vi.mock('../../src/services/auth/firebaseTokenVerifier.js', () => ({ verifyFirebaseIdToken: mocks.verify }));
vi.mock('../../src/services/auth/firebaseAccount.js', async original => ({ ...await original<typeof import('../../src/services/auth/firebaseAccount.js')>(), lookupFirebaseCreation: mocks.lookup }));
import { finishAuthFlow, startAuthFlow, FLOW_COOKIE } from '../../src/api/authFlow.js';
import { fingerprint, type AuthFlow } from '../../src/services/auth/flowStore.js';

const state = '10000000-0000-4000-8000-000000000001';
const eventId = '20000000-0000-4000-8000-000000000001';
const returnUrl = 'https://active-etf.inthewins.com/compare/etfs?type=tw&codes=00981A%2C00982A&metric=holdings&utm_source=qa';
function request(path: string, body: unknown, origin: string, form = false, binding = 'fixture-binding'): HttpRequest {
  return new Request(`https://active-etf.inthewins.com/api/auth/${path}`, { method: 'POST', headers: { origin, 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json', cookie: `${FLOW_COOKIE}=${binding}; _fbp=fb.1.1700000000000.fixture; _fbc=fb.1.1700000000000.fixture` }, body: form ? String(body) : JSON.stringify(body) }) as unknown as HttpRequest;
}
const callback = (extra: Record<string, string> = {}, binding?: string) => request('callback', new URLSearchParams({ state, idToken: 'signed.fixture.token', ...extra }), 'https://auth-app.gogowinners.me', true, binding);
let flow: AuthFlow;
beforeEach(() => {
  vi.clearAllMocks();
  flow = { _id: state, binding: fingerprint('fixture-binding'), returnUrl, createdAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 3600_000), trackingAllowed: true, metaUserData: { fbp: 'fb.1.1700000000000.fixture' }, status: 'pending' };
  mocks.get.mockResolvedValue(flow); mocks.claim.mockResolvedValue(flow); mocks.register.mockResolvedValue(eventId);
  mocks.finish.mockResolvedValue(undefined);
  mocks.verify.mockResolvedValue({ sub: 'fixture-uid', aud: 'fixture-project', email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 });
  mocks.lookup.mockResolvedValue(Date.now() - 30_000);
  mocks.capability.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());
describe('trusted ETF auth flow', () => {
  it('supports a release rollback switch and proxy HTTPS cookies', async () => {
    vi.stubEnv('ACTIVE_ETF_AUTH_STARTS_DISABLED', 'true');
    expect((await startAuthFlow(request('start', { intent: 'login', returnUrl }, 'https://active-etf.inthewins.com'))).status).toBe(503);
    vi.stubEnv('ACTIVE_ETF_AUTH_STARTS_DISABLED', 'false');
    const proxy = new Request('http://internal/api/auth/start', { method: 'POST', headers: { origin: 'https://active-etf.inthewins.com', 'content-type': 'application/json', 'x-forwarded-proto': 'https, http' }, body: JSON.stringify({ intent: 'login', returnUrl }) }) as unknown as HttpRequest;
    expect((await startAuthFlow(proxy)).cookies?.[0]).toMatchObject({ secure: true, sameSite: 'None' });
  });
  it('storage outage safely returns public research without creating a session', async () => {
    mocks.get.mockRejectedValue(new Error('fixture storage outage'));
    const response = await finishAuthFlow(callback({ returnUrl }));
    expect(response.status).toBe(303); expect(response.cookies).toEqual([]);
    expect(new Headers(response.headers).get('Location')).toContain('codes=00981A%2C00982A');
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('does not hand POST return state to an old Auth deployment', async () => {
    mocks.capability.mockResolvedValue(false);
    const response = await startAuthFlow(request('start', { intent: 'sign_up', returnUrl }, 'https://active-etf.inthewins.com'));
    expect(response.status).toBe(503); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('starts directly in register, retaining allowed state and consented attribution', async () => {
    const response = await startAuthFlow(request('start', { intent: 'sign_up', returnUrl: `${returnUrl}&idToken=discard&email=discard`, trackingAllowed: true }, 'https://active-etf.inthewins.com'));
    expect(response.status).toBe(200);
    const target = new URL(response.jsonBody.authUrl);
    expect(target.pathname).toBe('/register'); expect(target.searchParams.get('returnMode')).toBe('post');
    expect(target.searchParams.get('redirect')).toBe(returnUrl);
    expect(response.cookies?.[0]).toMatchObject({ httpOnly: true, secure: true, sameSite: 'None' });
    expect(mocks.create.mock.calls[0][0].metaUserData).toEqual({ fbp: 'fb.1.1700000000000.fixture', fbc: 'fb.1.1700000000000.fixture' });
    expect(JSON.stringify(response.jsonBody)).not.toMatch(/idToken|email/u);
  });
  it('denied tracking removes campaign and Meta matching data while preserving research', async () => {
    const response = await startAuthFlow(request('start', { intent: 'login', returnUrl, trackingAllowed: false }, 'https://active-etf.inthewins.com'));
    expect(new URL(response.jsonBody.authUrl).pathname).toBe('/sign-in');
    const stored = mocks.create.mock.calls[0][0];
    expect(stored.metaUserData).toEqual({}); expect(stored.returnUrl).not.toContain('utm_'); expect(stored.returnUrl).toContain('metric=holdings');
  });
  it('rejects foreign origins and open redirect destinations', async () => {
    expect((await startAuthFlow(request('start', { intent: 'sign_up', returnUrl }, 'https://evil.test'))).status).toBe(403);
    expect((await startAuthFlow(request('start', { intent: 'sign_up', returnUrl: 'https://evil.test' }, 'https://active-etf.inthewins.com'))).status).not.toBe(200);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('backend-proven new account gets one persisted receipt and token only in HttpOnly cookie', async () => {
    const response = await finishAuthFlow(callback({ authAction: 'login' }));
    expect(response.status).toBe(303); expect(new Headers(response.headers).get('Location')).toBe(returnUrl);
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(mocks.finish).toHaveBeenCalledWith(state, expect.objectContaining({ status: 'complete', registrationEventId: eventId }));
    expect(response.cookies?.[0]).toMatchObject({ name: 'active_etf_session', value: 'signed.fixture.token', httpOnly: true });
    expect(JSON.stringify(response.headers)).not.toContain('signed.fixture.token');
  });
  it.each(['existing', 'unknown', 'denied'])('%s account/capture does not create a registration event even with forged sign_up action', async kind => {
    if (kind === 'existing') mocks.lookup.mockResolvedValue(flow.createdAt.getTime() - 86400000);
    if (kind === 'unknown') mocks.lookup.mockResolvedValue(null);
    if (kind === 'denied') flow.trackingAllowed = false;
    expect((await finishAuthFlow(callback({ authAction: 'sign_up' }))).status).toBe(303);
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(state, expect.objectContaining({ status: 'complete' }));
  });
  it.each(['cancelled', 'failed'])('%s callback returns research without session or registration', async error => {
    const response = await finishAuthFlow(callback({ error }));
    expect(new Headers(response.headers).get('Location')).toContain(`error=${error}`);
    expect(response.cookies).toEqual([]); expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it('invalid token is an explicit failed return; replay and binding mismatch never establish sessions', async () => {
    mocks.verify.mockRejectedValue(new Error('fixture invalid'));
    expect(new Headers((await finishAuthFlow(callback())).headers).get('Location')).toContain('error=failed');
    mocks.verify.mockClear(); flow.status = 'complete';
    expect((await finishAuthFlow(callback())).cookies).toEqual([]); expect(mocks.verify).not.toHaveBeenCalled();
    const invalid = await finishAuthFlow(callback({ returnUrl }, 'wrong-binding'));
    expect(invalid.status).toBe(303); expect(new Headers(invalid.headers).get('Location')).toContain('metric=holdings');
    expect(new Headers(invalid.headers).get('Location')).not.toContain('utm_'); expect(invalid.cookies).toEqual([]); expect(mocks.register).not.toHaveBeenCalled();
  });
});
