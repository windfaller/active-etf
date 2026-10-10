import type { Db } from "mongodb";
import { logger } from "../../utils/logger.js";
import { advanceDataCacheGeneration, getDataCacheGeneration } from "./dataCacheVersion.js";
import { isRedisConfigured, redisGet, redisSetEx } from "./redisClient.js";

const namespace = "active-etf:v4";
const pendingLoads = new Map<string, Promise<unknown>>();
const maximumPendingLoads = 256;
let localRevision = 0;

export type DailyDataCacheStatus = "hit" | "miss" | "coalesced" | "bypass" | "error";

function ttlSeconds(): number {
  const value = Number(process.env.REDIS_DAILY_CACHE_TTL_SECONDS ?? 86400);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 86400;
}

function buildCacheKey(parts: Array<string | number>): string {
  return [namespace, ...parts.map((part) => encodeURIComponent(String(part)))].join(":");
}

async function coalesce<T>(key: string, loader: () => Promise<T>, onStatus?: (status: DailyDataCacheStatus) => void): Promise<T> {
  const existing = pendingLoads.get(key);
  if (existing) {
    onStatus?.("coalesced");
    return existing as Promise<T>;
  }
  const promise = Promise.resolve().then(loader);
  if (pendingLoads.size >= maximumPendingLoads) return promise;
  pendingLoads.set(key, promise);
  try {
    return await promise;
  } finally {
    if (pendingLoads.get(key) === promise) pendingLoads.delete(key);
  }
}

export async function getOrSetDailyCache<T>(
  parts: Array<string | number>,
  loader: (generation?: string) => Promise<T>,
  ttl = ttlSeconds(),
  onStatus?: (status: DailyDataCacheStatus) => void,
  suppliedGeneration?: string
): Promise<T> {
  const baseKey = buildCacheKey(parts);
  if (!isRedisConfigured()) {
    onStatus?.("bypass");
    return coalesce(`${baseKey}:bypass:${suppliedGeneration ?? localRevision}`, () => loader(suppliedGeneration), onStatus);
  }

  let generation: string;
  try {
    generation = suppliedGeneration ?? await getDataCacheGeneration(parts);
  } catch (error) {
    onStatus?.("error");
    logger.warn("Cache version read failed; loading without cache", { error: error instanceof Error ? error.message : String(error) });
    return coalesce(`${baseKey}:uncached:${localRevision}`, () => loader(), onStatus);
  }

  const key = buildCacheKey([...parts, "generation", generation]);
  return coalesce(key, async () => {
    let readFailed = false;
    try {
      const cached = await redisGet(key);
      if (cached !== null) {
        const value = JSON.parse(cached) as T;
        onStatus?.("hit");
        return value;
      }
    } catch (error) {
      readFailed = true;
      onStatus?.("error");
      logger.warn("Redis cache read skipped", { key, error: error instanceof Error ? error.message : String(error) });
    }

    if (!readFailed) onStatus?.("miss");
    const value = await loader(generation);
    try {
      // Late loaders can only populate their old generation, which new readers
      // never use after a committed invalidation, including on other hosts.
      await redisSetEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn("Redis cache write skipped", { key, error: error instanceof Error ? error.message : String(error) });
    }
    return value;
  }, onStatus);
}

export async function invalidateDailyCache(_etfCode: string, _tradeDate: string, db?: Db): Promise<void> {
  localRevision++;
  await advanceDataCacheGeneration("tw", db);
}

export async function invalidateGlobalEtfCache(db?: Db): Promise<void> {
  localRevision++;
  await advanceDataCacheGeneration("global", db);
}

export const dailyCacheKey = buildCacheKey;
