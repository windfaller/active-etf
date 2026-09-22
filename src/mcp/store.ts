import { DatabaseSync } from "node:sqlite";
import { secret, quotaDay, resetAt, AgentError } from "./core.js";
export { secret, hash, quotaDay, resetAt, AgentError } from "./core.js";

/** Single-node durable beta store. No market-data writes; mount a persistent volume in production. */
export class AgentStore {
  readonly db: DatabaseSync;
  constructor(
    path: string,
    public dailyLimit = 20,
    private clock = Date.now,
  ) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(kind,key));
      CREATE TABLE IF NOT EXISTS usage (member TEXT NOT NULL, day TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(member,day));
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, member TEXT NOT NULL, day TEXT NOT NULL, fingerprint TEXT NOT NULL, cost INTEGER NOT NULL, state TEXT NOT NULL, expires INTEGER NOT NULL, result TEXT);
      CREATE INDEX IF NOT EXISTS jobs_member ON jobs(member,day,state,expires);
      CREATE TABLE IF NOT EXISTS rates (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  put(kind: string, key: string, value: unknown, ttlMs: number) {
    this.db
      .prepare("INSERT OR REPLACE INTO records VALUES (?,?,?,?)")
      .run(kind, key, JSON.stringify(value), this.clock() + ttlMs);
  }
  get<T>(kind: string, key: string): T | null {
    const row = this.db
      .prepare("SELECT value FROM records WHERE kind=? AND key=? AND expires>?")
      .get(kind, key, this.clock());
    return row ? (JSON.parse(String(row.value)) as T) : null;
  }
  remove(kind: string, key: string) {
    this.db
      .prepare("DELETE FROM records WHERE kind=? AND key=?")
      .run(kind, key);
  }
  take<T>(kind: string, key: string): T | null {
    return this.transaction(() => {
      const v = this.get<T>(kind, key);
      this.remove(kind, key);
      return v;
    });
  }
  rate(key: string, limit: number, windowMs = 60_000) {
    const now = this.clock();
    const row = this.db
      .prepare(
        `INSERT INTO rates VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN ? ELSE expires END RETURNING count`,
      )
      .get(key, now + windowMs, now, now, now + windowMs);
    if (Number(row?.count) > limit) throw new AgentError("rate_limited", 429);
  }
  usage(member: string) {
    const now = this.clock(),
      day = quotaDay(now);
    const row = this.db
      .prepare("SELECT used FROM usage WHERE member=? AND day=?")
      .get(member, day);
    const pending = this.db
      .prepare(
        "SELECT COALESCE(SUM(cost),0) AS reserved FROM jobs WHERE member=? AND day=? AND state='pending' AND expires>?",
      )
      .get(member, day, now);
    const used = Number(row?.used ?? 0),
      reserved = Number(pending?.reserved ?? 0);
    return {
      plan: "free",
      dailyLimit: this.dailyLimit,
      used,
      reserved,
      remaining: Math.max(0, this.dailyLimit - used - reserved),
      resetsAt: resetAt(now),
      timezone: "Asia/Taipei",
    };
  }
  reserve(
    member: string,
    fingerprint: string,
    cost: number,
  ): { id: string; cached?: Record<string, unknown> } {
    return this.transaction(() => {
      const now = this.clock(),
        day = quotaDay(now);
      const cached = this.db
        .prepare(
          "SELECT result FROM jobs WHERE member=? AND day=? AND fingerprint=? AND state='done' AND expires>? ORDER BY expires DESC LIMIT 1",
        )
        .get(member, day, fingerprint, now);
      if (cached?.result)
        return { id: "", cached: JSON.parse(String(cached.result)) };
      const same = this.db
        .prepare(
          "SELECT id FROM jobs WHERE member=? AND fingerprint=? AND state='pending' AND expires>?",
        )
        .get(member, fingerprint, now);
      if (same) throw new AgentError("request_in_progress", 429);
      const pending = this.db
        .prepare(
          "SELECT COUNT(*) AS n FROM jobs WHERE member=? AND state='pending' AND expires>?",
        )
        .get(member, now);
      if (Number(pending?.n) >= 2)
        throw new AgentError("concurrency_limited", 429);
      if (this.usage(member).remaining < cost)
        throw new AgentError("quota_exceeded", 429);
      const id = secret();
      this.db
        .prepare("INSERT INTO jobs VALUES (?,?,?,?,?,?,?,NULL)")
        .run(id, member, day, fingerprint, cost, "pending", now + 120_000);
      return { id };
    });
  }
  complete(id: string, result: Record<string, unknown>, charge = true) {
    this.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT * FROM jobs WHERE id=? AND state='pending' AND expires>?",
        )
        .get(id, this.clock());
      if (!row) throw new AgentError("reservation_expired", 503);
      if (charge)
        this.db
          .prepare(
            "INSERT INTO usage VALUES (?,?,?) ON CONFLICT(member,day) DO UPDATE SET used=used+excluded.used",
          )
          .run(String(row.member), String(row.day), Number(row.cost));
      this.db
        .prepare("UPDATE jobs SET state='done',result=?,expires=? WHERE id=?")
        .run(JSON.stringify(result), this.clock() + 600_000, id);
    });
  }
  release(id: string) {
    this.db.prepare("DELETE FROM jobs WHERE id=? AND state='pending'").run(id);
  }
  revokeMember(member: string) {
    this.put("revocation", member, { at: this.clock() }, 366 * 86400_000);
  }
  cleanup() {
    const now = this.clock();
    this.db.prepare("DELETE FROM records WHERE expires<=?").run(now);
    this.db.prepare("DELETE FROM rates WHERE expires<=?").run(now);
    this.db.prepare("DELETE FROM jobs WHERE expires<=?").run(now);
    this.db
      .prepare("DELETE FROM usage WHERE day<?")
      .run(quotaDay(now - 90 * 86400_000));
  }
  close() {
    this.db.close();
  }
}
