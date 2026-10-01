import { AUTH_ORIGIN } from './returnPolicy.js';

/** Cache only a verified declaration, separately for each approved Auth origin. */
export function createAuthCapabilityCheck(fetcher: typeof fetch = (...args) => fetch(...args), now = Date.now) {
  const verifiedUntil = new Map<string, number>();
  return async (authOrigin = AUTH_ORIGIN): Promise<boolean> => {
    if ((verifiedUntil.get(authOrigin) ?? 0) > now()) return true;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Bypass a cached SPA fallback during a coordinated release.
        const query = new URLSearchParams({ contract: '1', probe: String(now()), attempt: String(attempt) });
        const response = await fetcher(`${authOrigin}/.well-known/active-etf-auth-flow.json?${query}`, {
          signal: AbortSignal.timeout(5000), cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }
        });
        if (!response.ok) {
          if (response.status >= 500) continue;
          return false;
        }
        const capability = await response.json() as { version?: number; return_mode?: string; product?: string };
        if (capability.version !== 1 || capability.return_mode !== 'post' || capability.product !== 'active_etf') return false;
        verifiedUntil.set(authOrigin, now() + 30_000);
        return true;
      } catch { /* One bounded retry for transient transport or stale non-JSON responses. */ }
    }
    return false;
  };
}

/** An old or unavailable Auth build never receives the new POST flow. */
export const supportsEtfPostReturn = createAuthCapabilityCheck();
