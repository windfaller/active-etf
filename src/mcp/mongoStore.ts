import type { Collection, Db } from "mongodb";
import {
  AgentError,
  hash,
  secret,
  quotaDay,
  resetAt,
  type AgentStorage,
} from "./core.js";
interface RecordDoc {
  _id: string;
  value: unknown;
  expires: Date;
}
interface Job {
  id: string;
  fingerprint: string;
  cost: number;
  state: "pending" | "done";
  expires: number;
  cacheKey?: string;
}
interface Ledger {
  _id: string;
  version: number;
  used: number;
  jobs: Job[];
  expires: Date;
}
/** CAS updates keep reservations and charges atomic across Function instances; no replica-set transactions required. */
export class MongoAgentStore implements AgentStorage {
  readonly dailyLimit = 20;
  private records: Collection<RecordDoc>;
  private ledgers: Collection<Ledger>;
  constructor(
    db: Db,
    namespace = "member_mcp",
    private clock = Date.now,
  ) {
    if (!/^[a-z0-9_]+$/.test(namespace))
      throw Error("Invalid storage namespace");
    this.records = db.collection(namespace + "_records", { timeoutMS: 2000 });
    this.ledgers = db.collection(namespace + "_usage", { timeoutMS: 2000 });
  }
  async ensureIndexes() {
    await Promise.all([
      this.records.createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
      this.ledgers.createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
    ]);
  }
  async put(kind: string, key: string, value: unknown, ttlMs: number) {
    await this.records.replaceOne(
      { _id: kind + ":" + key },
      { value, expires: new Date(this.clock() + ttlMs) },
      { upsert: true },
    );
  }
  async get<T>(kind: string, key: string): Promise<T | null> {
    const r = await this.records.findOne({
      _id: kind + ":" + key,
      expires: { $gt: new Date(this.clock()) },
    });
    return r ? (r.value as T) : null;
  }
  async remove(kind: string, key: string) {
    await this.records.deleteOne({ _id: kind + ":" + key });
  }
  async take<T>(kind: string, key: string): Promise<T | null> {
    const r = await this.records.findOneAndDelete({
      _id: kind + ":" + key,
      expires: { $gt: new Date(this.clock()) },
    });
    return r ? (r.value as T) : null;
  }
  async rate(key: string, limit: number, windowMs = 60_000) {
    const now = this.clock(),
      bucket = Math.floor(now / windowMs),
      id = "rate:" + hash(key) + ":" + bucket;
    const r = await this.records.findOneAndUpdate(
      { _id: id },
      [
        {
          $set: {
            value: { $add: [{ $ifNull: ["$value", 0] }, 1] },
            expires: new Date((bucket + 2) * windowMs),
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );
    if (Number(r?.value) > limit) throw new AgentError("rate_limited", 429);
  }
  private ledgerId(member: string) {
    return hash(member) + ":" + quotaDay(this.clock());
  }
  private async edit<T>(id: string, fn: (ledger: Ledger) => T): Promise<T> {
    const deadline = Date.now() + 4000;
    for (let attempt = 0; attempt < 20 && Date.now() < deadline; attempt++) {
      const old = await this.ledgers.findOne({ _id: id });
      const next: Ledger = old
        ? {
            ...old,
            jobs: old.jobs
              .filter((j) => j.expires > this.clock())
              .map((j) => ({ ...j })),
          }
        : {
            _id: id,
            version: 0,
            used: 0,
            jobs: [],
            expires: new Date(this.clock() + 90 * 86400_000),
          };
      const result = fn(next);
      next.version++;
      if (old) {
        const r = await this.ledgers.replaceOne(
          { _id: id, version: old.version },
          next,
        );
        if (r.modifiedCount) return result;
      } else {
        try {
          await this.ledgers.insertOne(next);
          return result;
        } catch (e) {
          if ((e as { code?: number }).code !== 11000) throw e;
        }
      }
    }
    throw new AgentError("request_in_progress", 429);
  }
  async usage(member: string) {
    const row = await this.ledgers.findOne({ _id: this.ledgerId(member) }),
      used = row?.used ?? 0,
      reserved = (row?.jobs ?? [])
        .filter((j) => j.state === "pending" && j.expires > this.clock())
        .reduce((n, j) => n + j.cost, 0);
    return {
      plan: "free",
      dailyLimit: this.dailyLimit,
      used,
      reserved,
      remaining: Math.max(0, this.dailyLimit - used - reserved),
      resetsAt: resetAt(this.clock()),
      timezone: "Asia/Taipei",
    };
  }
  async reserve(member: string, fingerprint: string, cost: number) {
    const ledgerId = this.ledgerId(member),
      id = ledgerId + "|" + secret();
    const reservation = await this.edit(ledgerId, (l) => {
      const same = l.jobs.find((j) => j.fingerprint === fingerprint);
      if (same?.state === "pending")
        throw new AgentError("request_in_progress", 429);
      if (same?.state === "done") return { id: "", cacheKey: same.cacheKey! };
      const pending = l.jobs.filter((j) => j.state === "pending");
      if (pending.length >= 2) throw new AgentError("concurrency_limited", 429);
      if (
        l.used + pending.reduce((n, j) => n + j.cost, 0) + cost >
        this.dailyLimit
      )
        throw new AgentError("quota_exceeded", 429);
      l.jobs.push({
        id,
        fingerprint,
        cost,
        state: "pending",
        expires: this.clock() + 120_000,
      });
      return { id };
    });
    if (reservation.cacheKey) {
      const cached = await this.get<Record<string, unknown>>(
        "result",
        reservation.cacheKey,
      );
      if (cached) return { id: "", cached };
      throw new AgentError("cached_result_unavailable", 503);
    }
    return { id };
  }
  async complete(id: string, result: Record<string, unknown>, charge = true) {
    const ledgerId = id.split("|")[0],
      cacheKey = hash(id);
    const current = await this.ledgers.findOne({_id:ledgerId});
    if (!current?.jobs.some(j=>j.id===id&&j.state==='pending'&&j.expires>this.clock())) throw new AgentError('reservation_expired',503);
    // Persist result before the atomic charge. A failed write cannot charge for an undeliverable result.
    await this.put("result", cacheKey, result, 660_000);
    await this.edit(ledgerId, (l) => {
      const j = l.jobs.find((j) => j.id === id && j.state === "pending");
      if (!j) throw new AgentError("reservation_expired", 503);
      if (charge) l.used += j.cost;
      j.state = "done";
      j.expires = this.clock() + 600_000;
      j.cacheKey = cacheKey;
    });
  }
  async release(id: string) {
    if (!id) return;
    await this.edit(id.split("|")[0], (l) => {
      l.jobs = l.jobs.filter((j) => !(j.id === id && j.state === "pending"));
    });
  }
  async revokeMember(member: string) {
    await this.put("revocation", member, { at: this.clock() }, 366 * 86400_000);
  }
}
