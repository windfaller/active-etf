import { describe, expect, it } from "vitest";
import { parseEzmoneyHoldings } from "../../src/services/parser/ezmoneyHoldingParser.js";
import { parseEzmoneyPcf } from "../../src/services/parser/ezmoneyPcfParser.js";

const rawBody = JSON.stringify({
  pcf: [
    { PCFCode: "NAV", Amount: 257_218_842_106, TranDate: "/Date(1778774400000)/" },
    { PCFCode: "OUT_UNIT", Amount: 9_078_209_000, TranDate: "/Date(1778774400000)/" },
    { PCFCode: "DIFF_UNIT", Amount: 0, TranDate: "/Date(1778774400000)/" },
    { PCFCode: "P_UNIT", Amount: 28.33, ValueDate: "115/05/15 " }
  ],
  asset: [
    { AssetCode: "GD", Value: 0, Details: [] },
    {
      AssetCode: "ST",
      Value: 244_519_834_210,
      Details: [
        {
          DetailCode: "2330",
          DetailName: "台積電",
          Share: 11_657_000,
          Amount: 26_403_105_000,
          NavRate: 10.26,
          TranDate: "/Date(1778774400000)/"
        },
        {
          DetailCode: "2383",
          DetailName: "台光電",
          Share: 4_723_000,
          Amount: 21_796_645_000,
          NavRate: 8.47,
          TranDate: "2026-05-15T00:00:00"
        }
      ]
    }
  ]
});

describe("ezmoney parsers", () => {
  it("parses holdings from GetPCF JSON", () => {
    const holdings = parseEzmoneyHoldings({
      etfCode: "00981A",
      tradeDate: "2026-05-15",
      rawSnapshotId: "snapshot",
      rawBody,
      contentType: "application/json"
    });

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "2330",
      stockName: "台積電",
      shares: 11_657_000,
      lots: 11_657,
      weight: 10.26,
      marketValue: 26_403_105_000
    });
  });

  it("parses summary from GetPCF JSON", () => {
    const summary = parseEzmoneyPcf({
      etfCode: "00981A",
      tradeDate: "2026-05-15",
      rawSnapshotId: "snapshot",
      rawBody,
      contentType: "application/json"
    });

    expect(summary).toMatchObject({
      etfCode: "00981A",
      tradeDate: "2026-05-15",
      nav: 28.33,
      totalUnits: 9_078_209_000,
      fundSize: 257_218_842_106,
      netCreationUnits: 0,
      stockRatio: 95.063,
      cashRatio: 4.937
    });
  });
});
