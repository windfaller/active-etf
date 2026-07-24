import type { Db } from "mongodb";
import { getDb } from "../db/mongo.js";
import { BoundedRequestCache, type RequestCacheStatus } from "../services/cache/boundedRequestCache.js";
import type { ServerTimingMetric } from "./response.js";

export interface TimedCachedResult<T> {
  value: T;
  metrics: ServerTimingMetric[];
}

export async function getTimedCached<T>(
  cache: BoundedRequestCache,
  key: string,
  ttlMilliseconds: number,
  loader: (db: Db) => Promise<T>
): Promise<TimedCachedResult<T>> {
  const totalStartedAt = Date.now();
  let cacheStatus: RequestCacheStatus = "miss";
  let mongoDuration = 0;
  let computeDuration = 0;
  const value = await cache.getOrLoad(key, ttlMilliseconds, async () => {
    const mongoStartedAt = Date.now();
    const db = await getDb();
    mongoDuration = Date.now() - mongoStartedAt;
    const computeStartedAt = Date.now();
    const result = await loader(db);
    computeDuration = Date.now() - computeStartedAt;
    return result;
  }, (status) => {
    cacheStatus = status;
  });

  return {
    value,
    metrics: [
      { name: "total", duration: Date.now() - totalStartedAt },
      { name: "app-cache", description: cacheStatus },
      { name: "mongo", duration: mongoDuration },
      { name: "compute", duration: computeDuration }
    ]
  };
}
