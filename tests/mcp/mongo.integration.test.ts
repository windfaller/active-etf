import "dotenv/config";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { MongoClient, type Db } from "mongodb";
import { MongoAgentStore } from "../../src/mcp/mongoStore.js";
import { secret } from "../../src/mcp/core.js";
const run = process.env.MCP_INTEGRATION === "1";
describe.skipIf(!run)(
  "MongoDB multi-instance ledger (isolated disposable collections)",
  () => {
    let client: MongoClient,
      db: Db,
      store: MongoAgentStore,
      second: MongoAgentStore;
    const prefix =
      "mcp_test_" +
      secret()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 16);
    let now = Date.parse("2026-09-22T15:58:00Z");
    beforeAll(async () => {
      client = new MongoClient(process.env.MONGODB_URI!, {
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      db = client.db(process.env.MONGODB_DB_NAME ?? "taiwan_active_etf");
      store = new MongoAgentStore(db, prefix, () => now);
      second = new MongoAgentStore(db, prefix, () => now);
      await store.ensureIndexes();
    });
    afterAll(async () => {
      if (db) {
        await db
          .collection(prefix + "_records")
          .drop()
          .catch(() => {});
        await db
          .collection(prefix + "_usage")
          .drop()
          .catch(() => {});
      }
      await client?.close();
    });
    it("consumes one-use codes once across instances and enforces expiry", async () => {
      await store.put("code", "one", { ok: true }, 1000);
      const r = await Promise.all([
        store.take("code", "one"),
        second.take("code", "one"),
      ]);
      expect(r.filter(Boolean)).toHaveLength(1);
      await store.put("code", "expired", true, 10);
      now += 11;
      expect(await second.get("code", "expired")).toBeNull();
    });
    it("reserves at most two concurrent jobs and charges no more than 20 points", async () => {
      const r = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) =>
          (i % 2 ? store : second).reserve("member", "concurrent-" + i, 2),
        ),
      );
      const jobs = r
        .filter((x) => x.status === "fulfilled")
        .map((x) => (x as PromiseFulfilledResult<{ id: string }>).value);
      expect(jobs).toHaveLength(2);
      expect((await store.usage("member")).reserved).toBe(4);
      await Promise.all(
        jobs.map((j) => store.complete(j.id, { sourceAsOf: "2026-09-21" })),
      );
      expect((await second.usage("member")).used).toBe(4);
      for (let i = 0; i < 8; i++) {
        const j = await second.reserve("member", "next-" + i, 2);
        await store.complete(j.id, { i });
      }
      expect((await second.usage("member")).remaining).toBe(0);
      await expect(store.reserve("member", "over", 1)).rejects.toThrow(
        "quota_exceeded",
      );
    });
    it("survives a new adapter, caches without reserving, refunds empty results and rejects double completion", async () => {
      const j = await store.reserve("cache-member", "same", 3);
      await store.complete(j.id, { value: 123 });
      const fresh = new MongoAgentStore(db, prefix, () => now);
      expect((await fresh.reserve("cache-member", "same", 3)).cached).toEqual({
        value: 123,
      });
      expect((await fresh.usage("cache-member")).used).toBe(3);
      const empty = await store.reserve("cache-member", "empty", 2);
      await fresh.complete(empty.id, { hasData: false }, false);
      expect((await store.usage("cache-member")).used).toBe(3);
      await expect(store.complete(empty.id, {})).rejects.toThrow(
        "reservation_expired",
      );
      const failed = await store.reserve("cache-member", "failure", 2);
      await second.release(failed.id);
      expect((await store.usage("cache-member")).reserved).toBe(0);
    });
    it("expires reservations and resets on Taipei midnight", async () => {
      const job = await store.reserve("new-day", "pending", 3);
      now += 121000;
      await expect(second.complete(job.id, {})).rejects.toThrow(
        "reservation_expired",
      );
      expect((await store.usage("member")).used).toBe(0);
    });
  },
);
