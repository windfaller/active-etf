import { ObjectId, type Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { demoGlobalEtfSnapshots, getGlobalEtfDailyReport } from "../../src/services/globalEtf/globalEtfService.js";

describe("global report predecessor reads", () => {
  it("bounds concurrent queries to four and preserves the snapshot/previous association", async () => {
    const snapshots = demoGlobalEtfSnapshots().filter((row) => row.strategyType !== "13f").slice(0, 6);
    const stored = snapshots.map(snapshot => ({ ...snapshot, _id: new ObjectId() }));
    let active = 0;
    let maximum = 0;
    const next = vi.fn(async (code: string) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      const current = snapshots.find((row) => row.etfCode === code)!;
      return { ...current, sourceAsOf: "2026-06-01", holdings: current.holdings.map((row) => ({ ...row, weightPercent: (row.weightPercent ?? 0) - 1 })) };
    });
    const db = { collection: () => ({
      find: (filter: { etfCode?: string; _id?: unknown }, options?: { projection?: unknown }) => {
        if (options?.projection) return { toArray: async () => stored.map(({ holdings, ...metadata }) => metadata) };
        if (filter._id) return { toArray: async () => [...stored].reverse() };
        return { sort: () => ({ limit: () => ({ next: () => next(filter.etfCode!) }) }) };
      }
    }) } as unknown as Db;
    const report = await getGlobalEtfDailyReport(db);

    expect(maximum).toBe(4);
    expect(next).toHaveBeenCalledTimes(snapshots.length);
    for (const snapshot of snapshots) {
      const section = report.sections.find((row) => row.etfCode === snapshot.etfCode)!;
      expect(section.sourceAsOf).toBe(snapshot.sourceAsOf);
      expect(section.weightChanges[0]?.deltaPp).toBe(1);
    }
  });
});
