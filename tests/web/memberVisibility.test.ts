import { describe, expect, it } from "vitest";
import { shouldMaskMemberResult } from "../../src/web/domain/memberVisibility.js";

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
});
