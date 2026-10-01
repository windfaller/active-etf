import { afterEach, expect, it, vi } from 'vitest';
import { supportsEtfPostReturn } from '../../src/services/auth/authCapability.js';
afterEach(() => vi.unstubAllGlobals());
it('requires the deployed Auth POST contract; SPA fallback and unavailable hosts fail closed', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const response of [new Response('<html>old SPA</html>'), new Response('{"version":1,"return_mode":"get","product":"active_etf"}'), new Response('{}', { status: 503 })]) {
    fetcher.mockResolvedValue(response); expect(await supportsEtfPostReturn()).toBe(false);
  }
  fetcher.mockResolvedValue(new Response('{"version":1,"return_mode":"post","product":"active_etf"}'));
  expect(await supportsEtfPostReturn()).toBe(true);
  expect(fetcher.mock.calls[0][0]).toBe('https://auth-app.gogowinners.me/.well-known/active-etf-auth-flow.json');
});
