import { afterEach, expect, it, vi } from 'vitest';
import { isNewAccountDuringFlow, lookupFirebaseCreation } from '../../src/services/auth/firebaseAccount.js';
import type { FirebaseIdTokenClaims } from '../../src/services/auth/firebaseTokenVerifier.js';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const claims = { sub: 'fixture', email: 'fixture@example.test' } as FirebaseIdTokenClaims;
it('validates identity provider metadata and verified email; failures remain unproven', async () => {
  vi.stubEnv('FIREBASE_WEB_API_KEY', 'fixture-public-key');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ users: [{ localId: 'fixture', createdAt: '1700000000000', emailVerified: true }] })));
  vi.stubGlobal('fetch', fetcher);
  expect(await lookupFirebaseCreation('fixture-token', claims)).toBe(1700000000000);
  expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify({ idToken: 'fixture-token' }));
  for (const user of [{ localId: 'other', createdAt: '1700000000000', emailVerified: true }, { localId: 'fixture', createdAt: '1700000000000', emailVerified: false }, { localId: 'fixture', createdAt: '1700000000000', emailVerified: true, disabled: true }, { localId: 'fixture', createdAt: 'bad' }, undefined]) {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ users: user ? [user] : [] })));
    expect(await lookupFirebaseCreation('fixture-token', claims)).toBeNull();
  }
});
it('new shared account requires creation within the verified, unexpired flow', () => {
  expect(isNewAccountDuringFlow(150, 100, 200)).toBe(true);
  for (const created of [null, 99, 201]) expect(isNewAccountDuringFlow(created, 100, 200)).toBe(false);
  expect(isNewAccountDuringFlow(150, 100, 100 + 86400001)).toBe(false);
});
