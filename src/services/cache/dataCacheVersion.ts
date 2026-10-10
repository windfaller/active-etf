import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { getDb } from "../../db/mongo.js";

export type DataCacheScope = "tw" | "global";
interface CacheVersion {
  _id: DataCacheScope;
  version: string;
  updatedAt: Date;
}

export function dataCacheScopes(parts: Array<string | number>): DataCacheScope[] {
  if (parts[0] === "global-etfs") return ["global"];
  if (parts[0] === "api" && parts[1] === "compare" && parts[3] === "global") return ["global"];
  if (parts[0] === "api" && parts[1] === "fund-performance") return ["tw", "global"];
  if (parts[0] === "mcp" && parts[1] === "research") return ["tw", "global"];
  return ["tw"];
}

// A primary point read on every request makes L1 invalidation visible across
// Function instances. This authoritative pointer is deliberately not cached.
export async function getDataCacheGeneration(parts: Array<string | number>, db?: Db): Promise<string> {
  const database = db ?? await getDb();
  const scopes = dataCacheScopes(parts);
  const collection = database.collection<CacheVersion>("data_cache_versions");
  if (scopes.length === 1) {
    const row = await collection.findOne({ _id: scopes[0] }, { projection: { version: 1 }, readPreference: "primary", readConcern: { level: "majority" }, maxTimeMS: 5000 });
    return `${scopes[0]}.${row?.version ?? "initial"}`;
  }
  const rows = await collection.find({ _id: { $in: scopes } }, { projection: { version: 1 }, readPreference: "primary", readConcern: { level: "majority" }, maxTimeMS: 5000 }).toArray();
  return scopes.map((scope) => `${scope}.${rows.find((row) => row._id === scope)?.version ?? "initial"}`).join(".");
}

export async function advanceDataCacheGeneration(scope: DataCacheScope, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  await database.collection<CacheVersion>("data_cache_versions").updateOne(
    { _id: scope },
    { $set: { version: randomUUID(), updatedAt: new Date() } },
    { upsert: true, writeConcern: { w: "majority" } }
  );
}
