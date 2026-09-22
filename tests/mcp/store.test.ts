import { describe, it, expect } from "vitest";
import { AgentStore, quotaDay, resetAt } from "../../src/mcp/store.js";
describe("free research quota", () => {
  it("rolls over at Taipei midnight", () => {
    const now = Date.parse("2026-09-22T15:59:59Z");
    expect(quotaDay(now)).toBe("2026-09-22");
    expect(quotaDay(now + 1000)).toBe("2026-09-23");
    expect(resetAt(now)).toBe("2026-09-22T16:00:00.000Z");
  });
  it("reserves atomically, enforces concurrency, and releases failures", () => {
    const s = new AgentStore(":memory:", 3);
    const a = s.reserve("u", "a", 2);
    expect(s.usage("u").remaining).toBe(1);
    expect(() => s.reserve("u", "b", 2)).toThrow("quota_exceeded");
    const b = s.reserve("u", "b", 1);
    expect(() => s.reserve("u", "c", 0)).toThrow("concurrency_limited");
    s.release(a.id);
    s.complete(b.id, { ok: true });
    expect(s.usage("u").used).toBe(1);
    expect(s.usage("u").remaining).toBe(2);
    s.close();
  });
  it("does not charge for retries, concurrent duplicates or empty data", () => {
    const s = new AgentStore(":memory:");
    const a = s.reserve("u", "a", 3);
    expect(() => s.reserve("u", "a", 3)).toThrow("request_in_progress");
    s.complete(a.id, { value: 1 });
    expect(s.reserve("u", "a", 3).cached).toEqual({ value: 1 });
    expect(s.usage("u").used).toBe(3);
    const b = s.reserve("u", "b", 2);
    s.complete(b.id, { hasData: false }, false);
    expect(s.usage("u").used).toBe(3);
    expect(s.usage("other").used).toBe(0);
    s.close();
  });
  it("recovers expired reservations without exceeding the next day allowance", () => {
    let time = Date.parse("2026-09-22T15:59:59Z");
    const s = new AgentStore(":memory:", 20, () => time);
    const a = s.reserve("u", "a", 3);
    time += 121_000;
    expect(() => s.complete(a.id, { ok: true })).toThrow("reservation_expired");
    expect(s.usage("u").remaining).toBe(20);
    s.close();
  });
  it("does not allow a completed reservation to double commit", () => {
    const s = new AgentStore(":memory:");
    const a = s.reserve("u", "a", 1);
    s.complete(a.id, {});
    expect(() => s.complete(a.id, {})).toThrow("reservation_expired");
    expect(s.usage("u").used).toBe(1);
    s.close();
  });
});
