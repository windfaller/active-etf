import {
  isRedisConfigured,
  redisGet,
  redisSetEx,
} from "../services/cache/redisClient.js";
import { hash } from "./core.js";
import type { ResearchProvider, ResearchData } from "./data.js";
/** Cache public research only. Auth and quota are always checked against MongoDB first. */
export function cachedResearchProvider(
  provider: ResearchProvider,
): ResearchProvider {
  return async (name, args) => {
    if (!isRedisConfigured()) return provider(name, args);
    const key =
      "active-etf:mcp:v1:research:" + hash(JSON.stringify([name, args]));
    try {
      const text = await redisGet(key);
      if (text) {
        const value = JSON.parse(text) as ResearchData;
        if (
          typeof value.hasData === "boolean" &&
          value.data &&
          typeof value.data === "object"
        )
          return value;
      }
    } catch {
      /* Cache outages never bypass auth or quota. */
    }
    const value = await provider(name, args),
      text = JSON.stringify(value);
    if (value.hasData && Buffer.byteLength(text) < 300_000)
      try {
        await redisSetEx(key, 300, text);
      } catch {
        /* Research remains available without Redis. */
      }
    return value;
  };
}
