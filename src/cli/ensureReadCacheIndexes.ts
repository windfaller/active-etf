import "dotenv/config";
import { ensureReadCacheIndexes } from "../db/indexes.js";
import { closeDb, getDb } from "../db/mongo.js";

try {
  const names = await ensureReadCacheIndexes(await getDb());
  console.log(JSON.stringify({ job: "ensureReadCacheIndexes", ensured: names.length, indexes: names }));
} finally {
  await closeDb();
}
