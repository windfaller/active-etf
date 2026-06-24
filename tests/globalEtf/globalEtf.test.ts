import { describe, expect, it } from "vitest";
import { configuredEtfs } from "../../src/config/etfs.js";
import { enabledGlobalEtfs } from "../../src/config/globalEtfs.js";
import { parseBlackRockBaiSpreadsheet, parseCorgiEuvRows, parseRoundhillDramCsv, parseTemaNasaCsv } from "../../src/providers/globalEtf/parser.js";
import { buildGlobalSnapshot } from "../../src/providers/globalEtf/normalizer.js";
import { calculateGlobalEtfChanges } from "../../src/services/globalEtf/changeCalculator.js";
import { demoGlobalEtfSnapshots, getGlobalEtfDailyReport } from "../../src/services/globalEtf/globalEtfService.js";

describe("global ETF product line", () => {
  it("keeps global ETF codes out of the Taiwan active ETF universe", () => {
    const taiwanCodes = new Set(configuredEtfs.map((etf) => etf.etfCode));
    expect(taiwanCodes.has("DRAM")).toBe(false);
    expect(taiwanCodes.has("NASA")).toBe(false);
    expect(taiwanCodes.has("BAI")).toBe(false);
    expect(taiwanCodes.has("EUV")).toBe(false);
    expect(enabledGlobalEtfs.map((etf) => etf.etfCode)).toEqual([
      "DRAM",
      "NASA",
      "BAI",
      "EUV",
      "DYNF",
      "BINC",
      "ICSH",
      "BALI",
      "CLOA"
    ]);
  });

  it("summarizes common holdings across global ETF snapshots", async () => {
    const report = await getGlobalEtfDailyReport();
    const asml = report.commonHoldings.find((row) => row.ticker === "ASML");

    expect(asml).toEqual(
      expect.objectContaining({
        ticker: "ASML",
        etfCount: 2
      })
    );
    expect(asml?.etfs.map((etf) => etf.etfCode).sort()).toEqual(["BAI", "EUV"]);
    expect(asml?.totalWeightPercent).toBeCloseTo(18.3);
  });

  it("parses NASA percent_of_nav as a fraction and preserves sector/country", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "NASA");
    expect(etf).toBeDefined();
    const parsed = parseTemaNasaCsv(
      "holdings_date,ticker,proper_name,cusip,percent_of_nav,shares,market_value,country,sector,is_cash\n2026-06-23,RKLB,Rocket Lab,123,0.096,100,9600,US,Aerospace,0",
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.sourceAsOf).toBe("2026-06-23");
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: "RKLB",
        weightPercent: 9.6,
        country: "US",
        sector: "Aerospace",
        assetType: "Equity"
      })
    );
  });

  it("filters EUV API rows to the newest holding_date before normalizing", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "EUV");
    expect(etf).toBeDefined();
    const parsed = parseCorgiEuvRows(
      [
        { holding_date: "2026-06-20T00:00:00Z", stock_ticker: "OLD", security_name: "Old Row", weightings: 99 },
        { holding_date: "2026-06-23T00:00:00Z", stock_ticker: "ASML", security_name: "ASML Holding", weightings: 14.2 },
        { holding_date: "2026-06-23T00:00:00Z", stock_ticker: "LRCX", security_name: "Lam Research", weightings: 8.4 }
      ],
      etf!,
      etf!.holdingsUrl!
    );
    const snapshot = buildGlobalSnapshot(etf!, { ...parsed, sourceUrl: etf!.holdingsUrl! });

    expect(parsed.sourceAsOf).toBe("2026-06-23");
    expect(snapshot.rowCount).toBe(2);
    expect(snapshot.holdings.map((holding) => holding.ticker)).toEqual(["ASML", "LRCX"]);
    expect(snapshot.unusableReason).toBeUndefined();
  });

  it("parses BlackRock namespaced spreadsheet XML for BAI holdings", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "BAI");
    expect(etf).toBeDefined();
    const parsed = parseBlackRockBaiSpreadsheet(
      `<?xml version="1.0"?>
      <ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <ss:Worksheet ss:Name="Holdings">
          <ss:Table>
            <ss:Row>
              <ss:Cell><ss:Data ss:Type="String">Fund Holdings as of</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Jun 23, 2026</ss:Data></ss:Cell>
            </ss:Row>
            <ss:Row>
              <ss:Cell><ss:Data ss:Type="String">Ticker</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Name</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Sector</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Asset Class</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Market Value</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Weight (%)</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Notional Value</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Quantity</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Price</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Location</ss:Data></ss:Cell>
            </ss:Row>
            <ss:Row>
              <ss:Cell><ss:Data ss:Type="String">NVDA</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">NVIDIA Corp</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Information Technology</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Equity</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">1,000,000</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">8.5</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">1,000,000</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">100</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">10000</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">United States</ss:Data></ss:Cell>
            </ss:Row>
          </ss:Table>
        </ss:Worksheet>
      </ss:Workbook>`,
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.sourceAsOf).toBe("2026-06-23");
    expect(parsed.rawRowCount).toBe(1);
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: "NVDA",
        name: "NVIDIA Corp",
        weightPercent: 8.5,
        shares: 100,
        country: "United States"
      })
    );
  });

  it("parses BlackRock fixed-income holdings without ticker column", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "ICSH");
    expect(etf).toBeDefined();
    const parsed = parseBlackRockBaiSpreadsheet(
      `<?xml version="1.0"?>
      <ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <ss:Worksheet ss:Name="Holdings">
          <ss:Table>
            <ss:Row>
              <ss:Cell><ss:Data ss:Type="String">Fund Holdings as of</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Jun 23, 2026</ss:Data></ss:Cell>
            </ss:Row>
            <ss:Row>
              <ss:Cell><ss:Data ss:Type="String">Name</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Sector</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Asset Class</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Market Value</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Weight (%)</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Notional Value</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Par Value</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Price</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Location</ss:Data></ss:Cell>
            </ss:Row>
            <ss:Row>
              <ss:Cell><ss:Data ss:Type="String">US TREASURY BILL</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Treasury</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">Fixed Income</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">1,000,000</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">5.5</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">1,000,000</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">1,000,000</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">99.5</ss:Data></ss:Cell>
              <ss:Cell><ss:Data ss:Type="String">United States</ss:Data></ss:Cell>
            </ss:Row>
          </ss:Table>
        </ss:Worksheet>
      </ss:Workbook>`,
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.rawRowCount).toBe(1);
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: undefined,
        name: "US TREASURY BILL",
        weightPercent: 5.5,
        parValue: 1_000_000,
        assetType: "Fixed Income"
      })
    );
  });

  it("normalizes DRAM swaps to underlying memory exposures and marks collateral as cash", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "DRAM");
    expect(etf).toBeDefined();
    const parsed = parseRoundhillDramCsv(
      [
        "Date,Account,StockTicker,CUSIP,SecurityName,Shares,MarketValue,Weightings,MoneyMarketFlag",
        "06/24/2026,DRAM,595112103 TRS 050427 NM,595112103 TRS 050427 NM,MICRON TECHNOLOGY INC SWAP NM,100,13,13.00%,",
        "06/24/2026,DRAM,MU,595112103,Micron Technology Inc,100,9,9.00%,",
        "06/24/2026,DRAM,2408 TT,6283,Nanya Technology Corp,100,3,3.00%,",
        "06/24/2026,DRAM,912797UP0,912797UP0,United States Treasury Bill 07/14/2026,100,16,16.00%,",
        "06/24/2026,DRAM,FGXXX,31846V336,First American Government Obligations Fund,100,10,10.00%,Y"
      ].join("\n"),
      etf!,
      etf!.sourceUrl
    );
    const snapshot = buildGlobalSnapshot(etf!, { ...parsed, sourceUrl: etf!.sourceUrl });
    const micron = snapshot.holdings.find((holding) => holding.ticker === "MU");

    expect(parsed.sourceAsOf).toBe("2026-06-24");
    expect(micron?.weightPercent).toBe(22);
    expect(snapshot.holdings.find((holding) => holding.name === "Nanya Technology Corp")?.ticker).toBe("2408.TW");
    expect(snapshot.holdings.filter((holding) => holding.assetType === "Cash")).toHaveLength(2);
    expect(snapshot.holdings.find((holding) => holding.name.includes("Treasury"))?.assetType).toBe("Cash");
  });

  it("calculates weight changes and renders a dark-mode-safe Top 10 report", async () => {
    const current = demoGlobalEtfSnapshots()[0];
    const previous = {
      ...current,
      sourceAsOf: "2026-06-20",
      holdings: current.holdings.map((holding) => ({
        ...holding,
        weightPercent: (holding.weightPercent ?? 0) - 0.2
      }))
    };
    const changes = calculateGlobalEtfChanges(current, previous);
    const report = await getGlobalEtfDailyReport();

    expect(changes[0]?.deltaPp).toBeCloseTo(0.2);
    expect(report.sections[0]?.topHoldings).toHaveLength(10);
    expect(report.html).toContain("background-color:#111827");
    expect(report.html).toContain("Top 10 持股");
    expect(report.adContext.tags).toEqual(expect.arrayContaining(["global-etf", "us-market", "ai", "semiconductor", "macro", "active-etf"]));
  });
});
