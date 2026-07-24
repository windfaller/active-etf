import type { Db } from "mongodb";
import { getDb } from "../db/mongo.js";
import { BoundedRequestCache, type RequestCacheStatus } from "../services/cache/boundedRequestCache.js";
import {
  getOrSetDailyCache,
  type DailyDataCacheStatus
} from "../services/cache/dailyDataCache.js";
import type { ServerTimingMetric } from "./response.js";

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
  let cacheStatus: RequestCacheStatus = "miss";
  let sharedCacheStatus: DailyDataCacheStatus | undefined;
  let mongoDuration = 0;
  let computeDuration = 0;
  const loadFromDatabase = async () => {
    const mongoStartedAt = Date.now();
    const db = await getDb();
    mongoDuration = Date.now() - mongoStartedAt;
    const computeStartedAt = Date.now();
    const result = await loader(db);
    computeDuration = Date.now() - computeStartedAt;
    return result;
  };
  const value = await cache.getOrLoad(key, ttlMilliseconds, () => {
    if (!options) return loadFromDatabase();
    return getOrSetDailyCache(
      options.sharedCacheKey,
      loadFromDatabase,
      options.sharedCacheTtlSeconds,
      (status) => {
        sharedCacheStatus = status;
      }
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
      { name: "mongo", duration: mongoDuration },
      { name: "compute", duration: computeDuration }
    ]
  };
}
