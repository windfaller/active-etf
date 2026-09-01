import { describe, expect, it } from "vitest";
import { isMemberLockedResult } from "../../src/domain/memberAccess.js";
import { projectGlobalRawReportForMember, projectGlobalWebReportForMember } from "../../src/api/getGlobalEtfs.js";
import { projectChangeCollectionsForMember, projectStockImpactForMember } from "../../src/api/memberProjection.js";
import type { EtfHoldingChange } from "../../src/models/EtfHoldingChange.js";

function change(stockId: string, activeDiffLots: number): EtfHoldingChange {
  return {
    stockId,
    stockName: `SECRET_${stockId}`,
    diffShares: activeDiffLots * 1000,
    diffLots: activeDiffLots,
    activeDiffShares: activeDiffLots * 1000,
    activeDiffLots,
    status: "increase"
  } as unknown as EtfHoldingChange;
}

describe("member API projections", () => {
  it("removes locked change records from anonymous JSON but returns them to members", () => {
    const first = change("FIRST", 30);
    const locked = change("LOCKED", 20);
    const third = change("THIRD", 10);
    const source = {
      topIncreases: [first, locked, third],
      topDecreases: [],
      topActiveIncreases: [first, locked, third],
      topActiveDecreases: [],
      newHoldings: [],
      exitedHoldings: [],
      tagMovements: [{ topStocks: [first, locked] }]
    };

    const anonymous = projectChangeCollectionsForMember(source, false);
    const member = projectChangeCollectionsForMember(source, true);

    expect(JSON.stringify(anonymous)).not.toContain("SECRET_LOCKED");
    expect(anonymous.topIncreases.some(isMemberLockedResult)).toBe(true);
    expect(JSON.stringify(member)).toContain("SECRET_LOCKED");
    expect(member.memberOperationRows).toHaveLength(3);
  });

  it("removes sector targets and alternating market rows before serialization", () => {
    const response = {
      impacts: [
        { stockId: "VISIBLE", stockName: "VISIBLE_NAME" },
        { stockId: "LOCKED", stockName: "SECRET_MARKET_ROW" }
      ],
      sectorSummary: {
        sectors: [{ sector: "半導體", topStocks: [{ stockId: "TARGET", stockName: "SECRET_TARGET" }] }]
      }
    };

    const anonymous = projectStockImpactForMember(response as never, false);
    const member = projectStockImpactForMember(response as never, true);

    expect(JSON.stringify(anonymous)).not.toContain("SECRET_MARKET_ROW");
    expect(JSON.stringify(anonymous)).not.toContain("SECRET_TARGET");
    expect(JSON.stringify(member)).toContain("SECRET_MARKET_ROW");
    expect(JSON.stringify(member)).toContain("SECRET_TARGET");
  });

  it("keeps global holding and change locks stable across raw, web, and reordered responses", () => {
    const rawHoldings = [
      { ticker: "AAA", name: "SECRET_A" },
      { ticker: "BBB", name: "SECRET_B" }
    ];
    const rawChanges = [
      { positionKey: "ticker:AAA", ticker: "AAA", name: "SECRET_CHANGE_A" },
      { positionKey: "ticker:BBB", ticker: "BBB", name: "SECRET_CHANGE_B" }
    ];
    const raw = projectGlobalRawReportForMember({
      highlights: [],
      commonHoldings: rawHoldings,
      globalMovers: [],
      sections: [{
        etfCode: "TEST",
        topHoldings: rawHoldings,
        newPositions: [],
        exitedPositions: [],
        weightChanges: rawChanges,
        shareChanges: [],
        marketValueChanges: [],
        sectorChanges: [],
        countryChanges: []
      }]
    } as never, false);
    const webHoldings = [...rawHoldings].reverse();
    const webChanges = [...rawChanges].reverse();
    const web = projectGlobalWebReportForMember({
      commonHoldings: webHoldings,
      commonWeightChanges: [],
      sections: [{ etfCode: "TEST", topHoldings: webHoldings, weightChanges: webChanges }]
    } as never, false);

    const lockMap = <T extends { name: string }>(source: T[], projected: unknown[]) =>
      Object.fromEntries(source.map((row, index) => [row.name, isMemberLockedResult(projected[index])])) as Record<string, boolean>;
    expect(lockMap(rawHoldings, raw.sections[0]!.topHoldings)).toEqual(lockMap(webHoldings, web.sections[0]!.topHoldings));
    expect(lockMap(rawChanges, raw.sections[0]!.weightChanges)).toEqual(lockMap(webChanges, web.sections[0]!.weightChanges));
  });
});
