import { afterEach, expect, it, vi } from 'vitest';
import { AUTH_ORIGIN, authOriginFor } from '../../src/services/auth/returnPolicy.js';
afterEach(() => vi.unstubAllEnvs());
it('paired QA is exact and cannot reroute production or other previews', () => {
  const etf = 'https://kind-coast-08b07e900-23.eastasia.7.azurestaticapps.net';
  const auth = 'https://black-desert-0cdbaeb00-1.eastasia.3.azurestaticapps.net';
  vi.stubEnv('ACTIVE_ETF_AUTH_QA_ORIGIN', etf); vi.stubEnv('ACTIVE_ETF_AUTH_QA_AUTH_ORIGIN', auth);
  expect(authOriginFor(etf)).toBe(auth);
  expect(authOriginFor('https://active-etf.inthewins.com')).toBe(AUTH_ORIGIN);
  expect(authOriginFor(etf.replace('-23.', '-24.'))).toBe(AUTH_ORIGIN);
  vi.stubEnv('ACTIVE_ETF_AUTH_QA_AUTH_ORIGIN', 'https://evil.test'); expect(authOriginFor(etf)).toBe(AUTH_ORIGIN);
});
