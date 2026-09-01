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
}

const jsonCache = new Map<string, JsonCacheEntry>();
const maxJsonCacheEntries = 64;

function cacheKey(path: string): string {
  return `${apiBase}${path}`;
}

export function readCachedJson<T>(path: string): T | null {
  const key = cacheKey(path);
  const entry = jsonCache.get(key);
  if (!entry) return null;
  jsonCache.delete(key);
  jsonCache.set(key, entry);
  return entry.value as T;
}

export function clearJsonCache(path?: string): void {
  if (path) jsonCache.delete(cacheKey(path));
  else jsonCache.clear();
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { signal, cache: "no-store", credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  const value = await response.json() as T;
  const key = cacheKey(path);
  jsonCache.delete(key);
  while (jsonCache.size >= maxJsonCacheEntries) {
    const oldestKey = jsonCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    jsonCache.delete(oldestKey);
  }
  jsonCache.set(key, { value });
  return value;
}
