import { ObjectId, type Db } from "mongodb";
import { describe, expect, it } from "vitest";
import { availableGlobalEtfSourceDates } from "../../src/services/globalEtf/globalEtfService.js";
import { selectLatestSnapshotIds, type SnapshotReadMetadata } from "../../src/services/globalEtf/snapshotSelection.js";
function row(etfCode: string, sourceAsOf: string, extras: Partial<SnapshotReadMetadata> = {}): SnapshotReadMetadata {
  return { _id: new ObjectId(), etfCode, sourceAsOf, fetchedAt: new Date("2026-10-08T10:00:00Z"), strategyType: "active", sourceStatus: "ok", ...extras };
}
describe("global report metadata selection", () => {
  it("keeps the source-date calendar unique, descending and limited while excluding unusable data", async () => {
    const rows = [row("DRAM", "2026-10-02"), row("BAI", "2026-10-02"), row("NASA", "2026-10-01"), row("EUV", "2026-10-03", { unusableReason: "bad source" }), row("BAI", "Jun 23, 20")];
    const db = { collection: () => ({ find: () => ({ toArray: async () => rows }) }) } as unknown as Db;
    expect(await availableGlobalEtfSourceDates(db, 1)).toEqual(["2026-10-02"]);
    expect(await availableGlobalEtfSourceDates(db, 180)).toEqual(["2026-10-02", "2026-10-01"]);
  });
  it("preserves historical cutoff, rejects unusable/malformed rows and selects the newest same-date capture", () => {
    const old = row("DRAM", "2026-10-01");
    const current = row("DRAM", "2026-10-02");
    const newerCapture = row("DRAM", "2026-10-02", { fetchedAt: new Date("2026-10-08T12:00:00Z") });
    const future = row("DRAM", "2026-10-08");
    const unusable = row("DRAM", "2026-10-02", { unusableReason: "bad source", fetchedAt: new Date("2026-10-09") });
    const malformed = row("DRAM", "Jun 23, 20");
    expect(selectLatestSnapshotIds([future, current, old, newerCapture, unusable, malformed], "2026-10-02")).toEqual([newerCapture._id]);
  });
  it("selects 13F by filedAt with source-date fallback, retaining the existing source-date cutoff", () => {
    const oldQuarterLaterFiling = row("ARK13F", "2026-03-31", { strategyType: "13f", filedAt: "2026-08-20" });
    const newerQuarter = row("ARK13F", "2026-06-30", { strategyType: "13f", filedAt: "2026-08-10" });
    const legacy = row("BRK13F", "2026-06-30", { strategyType: "13f" });
    expect(selectLatestSnapshotIds([newerQuarter, oldQuarterLaterFiling, legacy], "2026-10-02")).toEqual([oldQuarterLaterFiling._id, legacy._id]);
    expect(selectLatestSnapshotIds([newerQuarter, oldQuarterLaterFiling], "2026-05-01")).toEqual([oldQuarterLaterFiling._id]);
  });
  it("accepts missing/null usability fields and does not tighten the report source-status contract", () => {
    const absent = row("NASA", "2026-10-01");
    const nullable = row("BAI", "2026-10-01", { unusableReason: null as unknown as string });
    const priorAcceptedStatus = row("EUV", "2026-10-01", { sourceStatus: "failed" as SnapshotReadMetadata["sourceStatus"] });
    expect(selectLatestSnapshotIds([absent, nullable, priorAcceptedStatus])).toEqual([absent._id, nullable._id, priorAcceptedStatus._id]);
  });
});
