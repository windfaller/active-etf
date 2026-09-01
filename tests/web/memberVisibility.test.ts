import { describe, expect, it } from "vitest";
import {
  isMemberLockedResult,
  maskMemberResults,
  maskMemberResultsByStableKey,
  shouldRenderMemberLock,
  shouldMaskMemberResult,
  visibleMemberResults
} from "../../src/web/domain/memberVisibility.js";

describe("member result visibility", () => {
  it("never masks results for authenticated members", () => {
    expect([0, 1, 2, 3].map((index) => shouldMaskMemberResult(true, index))).toEqual([false, false, false, false]);
  });

  it("keeps the first anonymous result and masks every later result", () => {
    expect([0, 1, 2].map((index) => shouldMaskMemberResult(false, index, "after-first"))).toEqual([false, true, true]);
  });

  it("supports first-visible alternating previews", () => {
    expect([0, 1, 2, 3].map((index) => shouldMaskMemberResult(false, index, "alternating"))).toEqual([false, true, false, true]);
  });

  it("masks human-numbered odd rows when explicitly requested", () => {
    expect([0, 1, 2, 3].map((index) => shouldMaskMemberResult(false, index, "human-odd"))).toEqual([true, false, true, false]);
  });

  it("treats API sentinels as authoritative instead of remasking after client filtering", () => {
    const rows = maskMemberResults([{ id: "A" }, { id: "B" }, { id: "C" }], false);
    const filtered = rows.filter((row) => isMemberLockedResult(row) || row.id !== "A");
    expect(filtered.map((row, index) => shouldRenderMemberLock(filtered, row, false, index))).toEqual([true, false]);
    expect(visibleMemberResults(filtered)).toEqual([{ id: "C" }]);
  });

  it("keeps identity-based masks stable when display order changes", () => {
    const rows = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];
    const first = maskMemberResultsByStableKey(rows, false, (row) => row.id);
    const reversed = maskMemberResultsByStableKey([...rows].reverse(), false, (row) => row.id);
    const locked = (values: typeof first, source: typeof rows) => source.filter((_, index) => isMemberLockedResult(values[index])).map((row) => row.id).sort();
    expect(locked(first, rows)).toEqual(locked(reversed, [...rows].reverse()));
  });

  it("keeps the same identity locked when a query narrows the collection to one row", () => {
    const rows = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];
    const projected = maskMemberResultsByStableKey(rows, false, (row) => row.id);
    for (const [index, row] of rows.entries()) {
      const narrowed = maskMemberResultsByStableKey([row], false, (item) => item.id);
      expect(isMemberLockedResult(narrowed[0])).toBe(isMemberLockedResult(projected[index]));
    }
  });
});
