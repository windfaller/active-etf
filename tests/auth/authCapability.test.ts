import { expect, it, vi } from 'vitest';
import { createAuthCapabilityCheck } from '../../src/services/auth/authCapability.js';
const declaration = () => new Response('{"version":1,"return_mode":"post","product":"active_etf"}');
it('requires the deployed Auth POST contract; SPA fallback and unavailable hosts fail closed', async () => {
  for (const body of ['<html>old SPA</html>', '{"version":1,"return_mode":"get","product":"active_etf"}']) {
    const fetcher = vi.fn(() => Promise.resolve(new Response(body)));
    expect(await createAuthCapabilityCheck(fetcher)()).toBe(false);
  }
  const unavailable = vi.fn(() => Promise.resolve(new Response('{}', { status: 503 })));
  expect(await createAuthCapabilityCheck(unavailable)()).toBe(false);
  expect(unavailable).toHaveBeenCalledTimes(2);
});
it('retries a transient failure, bypasses stale CDN responses, and briefly reuses only verified declarations', async () => {
  let clock = 1000;
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(declaration());
  const check = createAuthCapabilityCheck(fetcher, () => clock);
  expect(await check()).toBe(true); expect(await check()).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const probe = new URL(fetcher.mock.calls[0][0]);
  expect(probe.origin).toBe('https://auth-app.gogowinners.me');
  expect(probe.pathname).toBe('/.well-known/active-etf-auth-flow.json');
  expect(probe.searchParams.get('probe')).toBe('1000');
  expect(fetcher.mock.calls[0][1].headers).toEqual({ 'Cache-Control': 'no-cache' });
  clock += 30_001; fetcher.mockResolvedValueOnce(declaration());
  expect(await check()).toBe(true); expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not reuse a production declaration for a QA Auth origin or cache a failed declaration', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(declaration()).mockResolvedValueOnce(new Response('{"version":0}')).mockResolvedValueOnce(declaration());
  const check = createAuthCapabilityCheck(fetcher);
  expect(await check()).toBe(true);
  const qa = 'https://black-desert-0cdbaeb00-1.eastasia.3.azurestaticapps.net';
  expect(await check(qa)).toBe(false); expect(await check(qa)).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(3);
});
