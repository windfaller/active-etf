interface ViteRuntimeImportMeta extends ImportMeta {
  env?: {
    DEV?: boolean;
    VITE_API_BASE_URL?: string;
  };
}

const runtimeEnv = (import.meta as ViteRuntimeImportMeta).env;
export const apiBase = runtimeEnv?.VITE_API_BASE_URL ?? (runtimeEnv?.DEV ? "http://127.0.0.1:7072" : "");

interface JsonCacheEntry {
  value: unknown;
  storedAt: number;
}

const jsonCache = new Map<string, JsonCacheEntry>();
const maxJsonCacheEntries = 64;
export const JSON_FRESH_MS = 30_000;
export const JSON_MAX_AGE_MS = 5 * 60_000;
let cacheGeneration = 0;
let sessionBarrier: Promise<unknown> = Promise.resolve();

// Only token exchange needs a barrier. Existing session cookies can read in parallel.
export function waitForJsonSession(session: Promise<unknown>): void {
  sessionBarrier = session;
}

function cacheKey(path: string): string {
  return `${apiBase}${path}`;
}

export function readCachedJson<T>(path: string): T | null {
  const key = cacheKey(path);
  const entry = jsonCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > JSON_MAX_AGE_MS) {
    jsonCache.delete(key);
    return null;
  }
  jsonCache.delete(key);
  jsonCache.set(key, entry);
  return entry.value as T;
}

export function clearJsonCache(path?: string): void {
  cacheGeneration += 1;
  if (path) jsonCache.delete(cacheKey(path));
  else jsonCache.clear();
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  await sessionBarrier;
  signal?.throwIfAborted();
  const key = cacheKey(path);
  const cached = jsonCache.get(key);
  if (cached && Date.now() - cached.storedAt < JSON_FRESH_MS) return readCachedJson<T>(path) as T;
  const generation = cacheGeneration;
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch(`${apiBase}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cache: "no-store", credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  const value = await response.json() as T;
  // A response from before login/logout/invalidation must never refill the new cache.
  if (generation !== cacheGeneration || signal?.aborted) return value;
  jsonCache.delete(key);
  while (jsonCache.size >= maxJsonCacheEntries) {
    const oldestKey = jsonCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    jsonCache.delete(oldestKey);
  }
  jsonCache.set(key, { value, storedAt: Date.now() });
  return value;
}
