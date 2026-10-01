import { AUTH_ORIGIN } from './returnPolicy.js';
/** Prevent a coordinated release from handing the POST contract to an old, query-token Auth build. */
export async function supportsEtfPostReturn(authOrigin = AUTH_ORIGIN): Promise<boolean> {
  try {
    const response = await fetch(`${authOrigin}/.well-known/active-etf-auth-flow.json`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) return false;
    const capability = await response.json() as { version?: number; return_mode?: string; product?: string };
    return capability.version === 1 && capability.return_mode === 'post' && capability.product === 'active_etf';
  } catch { return false; }
}
