import { logger } from "../../utils/logger.js";
import { isRedisConfigured, redisDel, redisGet, redisSetEx } from "./redisClient.js";

const namespace = "active-etf:v3";
const commonDateLimits = [10, 30, 60, 90, 120, 180, 365];
const commonSummaryHistoryLimits = [30, 60, 90, 120, 180];

function ttlSeconds(): number {
  return Number(process.env.REDIS_DAILY_CACHE_TTL_SECONDS ?? 86400);
}

function buildCacheKey(parts: Array<string | number>): string {
  return [namespace, ...parts.map((part) => String(part).replace(/[^A-Za-z0-9_.-]/g, "_"))].join(":");
}

export async function getOrSetDailyCache<T>(
  parts: Array<string | number>,
  loader: () => Promise<T>,
  ttl = ttlSeconds()
): Promise<T> {
  const key = buildCacheKey(parts);

  if (!isRedisConfigured()) {
    return loader();
  }

  try {
    const cached = await redisGet(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    logger.warn("Redis cache read skipped", {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const value = await loader();

  try {
    await redisSetEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    logger.warn("Redis cache write skipped", {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return value;
}

export async function invalidateDailyCache(etfCode: string, tradeDate: string): Promise<void> {
  if (!isRedisConfigured()) return;

  const keys = [
    buildCacheKey(["etf", etfCode, "holdings", tradeDate]),
    buildCacheKey(["etf", etfCode, "summary", tradeDate]),
    buildCacheKey(["etf", etfCode, "changes", tradeDate]),
    buildCacheKey(["dashboard", etfCode, tradeDate]),
    buildCacheKey(["market", "stock-impact", tradeDate]),
    buildCacheKey(["etf", "active", "ranking", tradeDate]),
    buildCacheKey(["etfs", "coverage", tradeDate]),
    ...commonDateLimits.map((limit) => buildCacheKey(["etf", etfCode, "dates", limit])),
    ...commonSummaryHistoryLimits.map((limit) => buildCacheKey(["etf", etfCode, "summary-history", limit]))
  ];

  try {
    await redisDel(keys);
  } catch (error) {
    logger.warn("Redis cache invalidation skipped", {
      etfCode,
      tradeDate,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function invalidateGlobalEtfCache(): Promise<void> {
  if (!isRedisConfigured()) return;

  const keys = [buildCacheKey(["global-etfs", "daily-report"])];

  try {
    await redisDel(keys);
  } catch (error) {
    logger.warn("Redis global ETF cache invalidation skipped", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export const dailyCacheKey = buildCacheKey;
