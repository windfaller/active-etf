import { describe, expect, it } from "vitest";
import { sectorProfileForStock, themeTagsForStock } from "../../src/services/sector/sectorMapping.js";

describe("sector theme tags", () => {
  it("adds AI semiconductor tags for TSMC", () => {
    expect(sectorProfileForStock("2330", "台積電")).toMatchObject({
      sector: "ASIC",
      themeTags: expect.arrayContaining(["AI", "晶圓代工", "CoWoS"])
    });
  });

  it("adds CPO and optical tags for optical names", () => {
    expect(sectorProfileForStock("6442", "光聖")).toMatchObject({
      sector: "CPO",
      themeTags: expect.arrayContaining(["CPO", "光通訊"])
    });
  });

  it("keeps heuristic tags for unmapped power equipment names", () => {
    expect(themeTagsForStock("9999", "台灣重電")).toContain("電力設備");
  });

  it("keeps unknown stocks conservative", () => {
    expect(sectorProfileForStock("0000", "未知公司")).toMatchObject({
      sector: "其他",
      themeTags: []
    });
  });
});
