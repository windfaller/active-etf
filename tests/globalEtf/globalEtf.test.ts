import { describe, expect, it } from "vitest";
import { configuredEtfs } from "../../src/config/etfs.js";
import { enabledGlobalEtfs } from "../../src/config/globalEtfs.js";
import {
  parseAlgerDailyHoldingsCsv,
  parseAllianceBernsteinUsTopHoldingsJson,
  parseBlackRockBaiSpreadsheet,
  parseCorgiEuvRows,
  parseJanusHendersonFullHoldingsHtml,
  parseRoundhillDramCsv,
  parseSec13fInformationTable,
  parseTemaNasaCsv,
  parseTuttleNavstarHoldingsJson
} from "../../src/providers/globalEtf/parser.js";
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
      "WELD",
      "HRTS",
      "CANC",
      "TOLL",
      "VOLT",
      "DSPY",
      "ARMY",
      "PRVT",
      "DISK",
      "LAZR",
      "BAI",
      "HBMX",
      "JHAI",
      "ALAI",
      "FWD",
      "EUV",
      "DYNF",
      "BINC",
      "ICSH",
      "BALI",
      "CLOA",
      "ARK13F",
      "BRK13F",
      "PSQ13F",
      "APP13F",
      "IDEF",
      "BDYN",
      "IALT"
    ]);
  });

  it("keeps enabled ETFs visible even before a holdings snapshot exists", async () => {
    const report = await getGlobalEtfDailyReport();
    const hbmx = report.sections.find((section) => section.etfCode === "HBMX");

    expect(hbmx).toEqual(
      expect.objectContaining({
        fundName: "Tuttle Capital Concentrated Memory Stack ETF",
        sourceStatus: "unavailable",
        rowCount: 0,
        topHoldings: []
      })
    );
    expect(report.coveredEtfs).toContain("JHAI");
    expect(report.coveredEtfs).toContain("ALAI");
    expect(report.coveredEtfs).toContain("FWD");
  });

  it("enables every listed Tema ETF with verified holdings URLs", () => {
    const temaEtfs = enabledGlobalEtfs.filter((etf) => etf.providerId === "tema");

    expect(temaEtfs.map((etf) => etf.etfCode)).toEqual(["NASA", "WELD", "HRTS", "CANC", "TOLL", "VOLT", "DSPY", "ARMY", "PRVT", "DISK", "LAZR"]);
    expect(temaEtfs.every((etf) => etf.enabled && etf.sourceStatus === "verified")).toBe(true);
    expect(temaEtfs.every((etf) => etf.holdingsUrl?.startsWith("https://temaetfs.com/hubfs/Website/Holdings/"))).toBe(true);
    expect(temaEtfs.find((etf) => etf.etfCode === "PRVT")?.holdingsUrl).toBe("https://temaetfs.com/hubfs/Website/Holdings/AAUM-holdings.csv");
  });

  it("enables user-priority AI ETFs with verified source endpoints", () => {
    const userPriority = enabledGlobalEtfs.filter((etf) => ["HBMX", "JHAI", "ALAI", "FWD"].includes(etf.etfCode));

    expect(userPriority.map((etf) => etf.etfCode)).toEqual(["HBMX", "JHAI", "ALAI", "FWD"]);
    expect(userPriority.every((etf) => etf.sourceStatus === "verified" && Boolean(etf.holdingsUrl))).toBe(true);
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
      [
        "holdings_date,ticker,proper_name,cusip,percent_of_nav,shares,market_value,country,sector,is_cash",
        "2026-06-23,RKLB,Rocket Lab,123,0.096,100,9600,US,Aerospace,0",
        "2026-06-23,285A JP,Kioxia Holdings Corp,,0.08,100,8000,Japan,Information Technology,0",
        "2026-06-23,SPACEX SPV,SPACEX SPV EXPOSURE,SPACEX SPV,0.12,100,12000,US,Aerospace,0"
      ].join("\n"),
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
    expect(parsed.holdings.find((holding) => holding.name === "SPACEX SPV EXPOSURE")).toEqual(
      expect.objectContaining({
        ticker: undefined,
        identifier: "SPACEX SPV",
        weightPercent: 12
      })
    );
    expect(parsed.holdings.find((holding) => holding.name === "Kioxia Holdings Corp")?.ticker).toBe("285A.JP");
  });

  it("parses HBMX NavStar holdings JSON", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "HBMX");
    expect(etf).toBeDefined();
    const parsed = parseTuttleNavstarHoldingsJson(
      JSON.stringify({
        fund: { ticker: "HBMX" },
        holdings: [
          {
            as_of_date: "2026-07-14",
            security_name: "Micron Technology Inc",
            security_ticker: "MU",
            security_id: "595112103",
            weight: 8.43,
            market_value: 3143034.64,
            quantity: 3197,
            currency: "USD"
          },
          {
            as_of_date: "2026-07-14",
            security_name: "Cash & Other",
            security_ticker: "Cash&Other",
            security_id: "Cash&Other",
            weight: -0.04,
            market_value: -13073.34,
            quantity: -13073.34,
            currency: "USD"
          }
        ]
      }),
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.sourceAsOf).toBe("2026-07-14");
    expect(parsed.rawRowCount).toBe(2);
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: "MU",
        name: "Micron Technology Inc",
        identifier: "595112103",
        weightPercent: 8.43,
        shares: 3197,
        marketValue: 3143034.64,
        assetType: "Equity"
      })
    );
    expect(parsed.holdings[1]?.assetType).toBe("Cash");
  });

  it("parses JHAI full holdings HTML", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "JHAI");
    expect(etf).toBeDefined();
    const parsed = parseJanusHendersonFullHoldingsHtml(
      `<p>(As of <span class="notranslate">07/14/2026</span>)</p>
      <table id="full_holdings">
        <tbody>
          <tr>
            <td>NVIDIA Corp</td>
            <td class="data-key-ticker">NVDA US</td>
            <td class="data-key-cusip">67066G104</td>
            <td class="data-key-underlyingSecurity"></td>
            <td class="data-key-quantity">1,000</td>
            <td class="data-key-marketValue">$1,234,567</td>
            <td class="data-key-percentOfPortfolio">6.78%</td>
          </tr>
        </tbody>
      </table>`,
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.sourceAsOf).toBe("2026-07-14");
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: "NVDA",
        name: "NVIDIA Corp",
        identifier: "67066G104",
        shares: 1000,
        marketValue: 1_234_567,
        weightPercent: 6.78
      })
    );
  });

  it("parses ALAI daily holdings CSV", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "ALAI");
    expect(etf).toBeDefined();
    const parsed = parseAlgerDailyHoldingsCsv(
      [
        "Product Short Name,Effective Date,Ticker,CUSIP,Security Description,Quantity,Market Value,Percentage Weight",
        'ALAI,07/14/2026,SE,81141R100,SEA LTD USD 0.0005 ADR,69289.0000,"7,572,595.00",1.65 %',
        'ALAI,07/14/2026,9A9OA92,805991551,PFD SB TECHNOLOGY INC SERIES E PFD,51208.0000,"1,840,928.00",0.40 %'
      ].join("\n"),
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.sourceAsOf).toBe("2026-07-14");
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: "SE",
        identifier: "81141R100",
        name: "SEA LTD USD 0.0005 ADR",
        shares: 69289,
        marketValue: 7_572_595,
        weightPercent: 1.65
      })
    );
  });

  it("parses FWD official AB daily Top 10 holdings JSON", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "FWD");
    expect(etf).toBeDefined();
    const parsed = parseAllianceBernsteinUsTopHoldingsJson(
      JSON.stringify({
        domesticHoldings: [
          {
            asOfDate: "07/15/2026",
            holdingCategory: "holdings-section-top ten equity holdings",
            holdings: [
              { holding: "NVIDIA Corp.", classification: "Information Technology", holdingPerc: "3.20" },
              { holding: "Total", classification: "", holdingPerc: "21.62" }
            ]
          }
        ]
      }),
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.sourceAsOf).toBe("2026-07-15");
    expect(parsed.rawRowCount).toBe(1);
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        name: "NVIDIA Corp.",
        sector: "Information Technology",
        weightPercent: 3.2,
        assetType: "Equity"
      })
    );
  });

  it("parses SEC 13F information tables, maps known CUSIPs, and derives weights", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "BRK13F");
    expect(etf).toBeDefined();
    const parsed = parseSec13fInformationTable(
      `<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
        <infoTable>
          <nameOfIssuer>APPLE INC</nameOfIssuer>
          <titleOfClass>COM</titleOfClass>
          <cusip>037833100</cusip>
          <value>750</value>
          <shrsOrPrnAmt>
            <sshPrnamt>10</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
          </shrsOrPrnAmt>
        </infoTable>
        <infoTable>
          <nameOfIssuer>AMERICAN EXPRESS CO</nameOfIssuer>
          <titleOfClass>COM</titleOfClass>
          <cusip>025816109</cusip>
          <value>250</value>
          <shrsOrPrnAmt>
            <sshPrnamt>5</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
          </shrsOrPrnAmt>
        </infoTable>
        <infoTable>
          <nameOfIssuer>UNMAPPED PRIVATE HOLDING</nameOfIssuer>
          <titleOfClass>COM</titleOfClass>
          <cusip>999999999</cusip>
          <value>0</value>
          <shrsOrPrnAmt>
            <sshPrnamt>1</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
          </shrsOrPrnAmt>
        </infoTable>
      </informationTable>`,
      etf!,
      "https://www.sec.gov/example.xml",
      "2026-05-15"
    );

    expect(parsed.sourceAsOf).toBe("2026-05-15");
    expect(parsed.rawRowCount).toBe(3);
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: "AAPL",
        name: "APPLE INC",
        identifier: "037833100",
        weightPercent: 75,
        shares: 10,
        marketValue: 750,
        assetType: "Equity"
      })
    );
    expect(parsed.holdings.find((holding) => holding.name === "UNMAPPED PRIVATE HOLDING")).toEqual(
      expect.objectContaining({
        ticker: undefined,
        identifier: "999999999",
        weightPercent: 0
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
        "06/24/2026,DRAM,000660 KS,6450267,SK hynix Inc,100,7,7.00%,",
        "06/24/2026,DRAM,SKHY,78392B206,SK hynix Inc,100,1,1.00%,",
        "06/24/2026,DRAM,6450267 TRS 050427 NM,6450267 TRS 050427 NM,SK HYNIX INC SWAP NM,100,2,2.00%,",
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
    const skHynix = snapshot.holdings.find((holding) => holding.ticker === "SKHY");
    expect(skHynix).toEqual(
      expect.objectContaining({
        name: "SK Hynix Inc",
        weightPercent: 10
      })
    );
    expect(skHynix?.exposureComponents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ticker: "000660.KS", weightPercent: 7, assetType: "Equity" }),
        expect.objectContaining({ ticker: "SKHY", weightPercent: 1, assetType: "Equity" }),
        expect.objectContaining({ weightPercent: 2, assetType: "Equity Swap" })
      ])
    );
    expect(snapshot.holdings.find((holding) => holding.ticker === "000660.KS")).toBeUndefined();
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
