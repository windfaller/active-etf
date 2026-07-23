import { describe, expect, it } from "vitest";
import { directionTone, valueTone } from "../../src/web/utils/format.js";

describe("semantic value tones", () => {
  it("uses Taiwan market colors only for actual positive and negative values", () => {
    expect(valueTone(1)).toBe("positive");
    expect(valueTone(-1)).toBe("negative");
    expect(valueTone(0)).toBe("neutral");
    expect(valueTone(null)).toBe("neutral");
    expect(valueTone(undefined)).toBe("neutral");
    expect(valueTone(Number.NaN)).toBe("neutral");
  });

  it("maps increase and decrease directions without treating unknown as positive", () => {
    expect(directionTone("increase")).toBe("positive");
    expect(directionTone("decrease")).toBe("negative");
    expect(directionTone("neutral")).toBe("neutral");
    expect(directionTone("unknown")).toBe("neutral");
  });
});
