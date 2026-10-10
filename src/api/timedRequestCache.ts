import type { Db } from "mongodb";
import { getDb } from "../db/mongo.js";
import { BoundedRequestCache, type RequestCacheStatus } from "../services/cache/boundedRequestCache.js";
import {
  getOrSetDailyCache,
  type DailyDataCacheStatus
} from "../services/cache/dailyDataCache.js";
import type { ServerTimingMetric } from "./response.js";
import { getDataCacheGeneration } from "../services/cache/dataCacheVersion.js";
import { logger } from "../utils/logger.js";

export interface TimedCachedResult<T> {
  value: T;
  metrics: ServerTimingMetric[];
}

export interface TimedCacheOptions {
  sharedCacheKey: Array<string | number>;
  sharedCacheTtlSeconds: number;
}

export async function getTimedCached<T>(
  cache: BoundedRequestCache,
  key: string,
  ttlMilliseconds: number,
  loader: (db: Db) => Promise<T>,
  options?: TimedCacheOptions
): Promise<TimedCachedResult<T>> {
  const totalStartedAt = Date.now();
  let cacheStatus: RequestCacheStatus | "bypass" = "miss";
  let sharedCacheStatus: DailyDataCacheStatus | undefined;
  let connectionDuration = 0;
  let dataLoadDuration = 0;
  let versionDuration = 0;
  const loadFromDatabase = async () => {
    const mongoStartedAt = Date.now();
    const db = await getDb();
    connectionDuration = Date.now() - mongoStartedAt;
    const computeStartedAt = Date.now();
    const result = await loader(db);
    dataLoadDuration = Date.now() - computeStartedAt;
    return result;
  };
  let generation: string | undefined;
  let versionReadFailed = false;
  if (options) {
    const versionStartedAt = Date.now();
    try {
      generation = await getDataCacheGeneration(options.sharedCacheKey);
    } catch (error) {
      versionReadFailed = true;
      cacheStatus = "bypass";
      sharedCacheStatus = "error";
      logger.warn("Request cache version unavailable; bypassing both cache layers", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      versionDuration = Date.now() - versionStartedAt;
    }
  }
  const value = versionReadFailed ? await loadFromDatabase() : await cache.getOrLoad(`${key}:${generation ?? "local"}`, ttlMilliseconds, () => {
    if (!options) return loadFromDatabase();
    return getOrSetDailyCache(
      options.sharedCacheKey,
      loadFromDatabase,
      options.sharedCacheTtlSeconds,
      (status) => {
        sharedCacheStatus = status;
      },
      generation
    );
  }, (status) => {
    cacheStatus = status;
  });

  return {
    value,
    metrics: [
      { name: "total", duration: Date.now() - totalStartedAt },
      { name: "app-cache", description: cacheStatus },
      ...(sharedCacheStatus ? [{ name: "shared-cache", description: sharedCacheStatus }] : []),
      { name: "cache-version", duration: versionDuration },
      { name: "db-connect", duration: connectionDuration },
      { name: "data-load", duration: dataLoadDuration, description: "Mongo queries and computation" }
    ]
  };
}
