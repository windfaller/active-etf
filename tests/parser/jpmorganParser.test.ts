import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  detectJpmorganPcfTradeDate,
  parseJpmorganHoldings,
  parseJpmorganPcfRows,
  parseJpmorganSummary
} from "../../src/providers/jpmorgan/parser.js";
import { normalizeJpmorganHoldings, normalizeJpmorganSummary } from "../../src/providers/jpmorgan/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

function cellRef(row: number, column: number): string {
  let value = column + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - remainder - 1) / 26);
  }

  return `${letters}${row}`;
}

function createXlsxBase64(rows: (string | number | null)[][]): string {
  const sharedStrings: string[] = [];
  const sharedStringIndexes = new Map<string, number>();
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          if (value === null || value === undefined || value === "") return "";

          const ref = cellRef(rowIndex + 1, columnIndex);
          if (typeof value === "number") {
            return `<c r="${ref}" t="n"><v>${value}</v></c>`;
          }

          let sharedIndex = sharedStringIndexes.get(value);
          if (sharedIndex === undefined) {
            sharedIndex = sharedStrings.length;
            sharedStringIndexes.set(value, sharedIndex);
            sharedStrings.push(value);
          }

          return `<c r="${ref}" t="s"><v>${sharedIndex}</v></c>`;
        })
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?><sst>${sharedStrings
    .map((value) => `<si><t>${value}</t></si>`)
    .join("")}</sst>`;
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${sheetRows}</sheetData></worksheet>`;
  const files = [
    { name: "xl/sharedStrings.xml", body: Buffer.from(sharedStringsXml) },
    { name: "xl/worksheets/sheet1.xml", body: Buffer.from(sheetXml) }
  ];
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(file.body.length, 18);
    local.writeUInt32LE(file.body.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, file.body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(file.body.length, 20);
    central.writeUInt32LE(file.body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + file.body.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localFiles.length, 16);

  return Buffer.concat([localFiles, centralDirectory, eocd]).toString("base64");
}

const rows = [
  [
    "Record Type",
    "Fund Ticker",
    "Fund Name",
    "Fund Cusip",
    "Fund Base Currency",
    "Fund Listing Exchange",
    "Valuation Date",
    "Component Count",
    "Balancing Cash",
    "Gain or Loss Value",
    "Estimated NAV",
    "Estimated NAV per Share",
    "Outstanding Shares"
  ],
  ["H", "00401A", "JPMorgan Taiwan ETF", "TW00000401A1", "TWD", "TWSE", "20260518", 3, 0, 0, 1_000_000, 12.5, 80_000],
  [
    "Record Type",
    "Constituent ISIN",
    "Constituent CUSIP",
    "Constituent SEDOL",
    "Constituent Ticker",
    "Constituent MIC",
    "Security Identifier",
    "Constituent Type",
    "Constituent Description",
    "Shares or PAR Amount",
    "Currency",
    "Price Local (T-1)",
    "FX Rate (T-1)",
    "Price Local",
    "Price Base",
    "FX Rate",
    "Contract Size",
    "Market Value Base"
  ],
  ["D", "TW0002330008", null, "6889106", "2330", "XTAI", "2330", "Equity", "TAIWAN SEMICONDUCTOR MFG CO. LTD", 1_000, "TWD", 900, 1, 950, 950, 1, null, 950_000],
  ["D", "TWTXO070DF62", null, null, "TXO", "XTAF", "TXO", "Option", "TWSE 05/20/26 C37400", 1, "TWD", 1, 1, 1, 1, 1, null, 1_000],
  ["D", "TW0002308004", null, "6260734", "2308", "XTAI", "2308", "Equity", "DELTA ELECTRONICS INC TWD10", 2_000, "TWD", 100, 1, 25, 25, 1, null, 50_000]
];

const rawBody = createXlsxBase64(rows);
const fetchResult = {
  url: "https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00401A_TW00000401A1.xlsx",
  method: "GET" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/xlxs",
  rawBody
};

describe("jpmorgan provider parser", () => {
  it("parses summary and filters equity rows from official PCF workbook shape", () => {
    const parsed = parseJpmorganPcfRows(rows.map((row) => row.map((value) => (value === null ? "" : String(value)))));

    expect(parsed.summary).toMatchObject({
      tradeDate: "2026-05-18",
      nav: 12.5,
      totalUnits: 80_000,
      fundSize: 1_000_000
    });
    expect(parsed.holdings).toHaveLength(2);
    expect(parsed.holdings[0]).toMatchObject({
      stockId: "2330",
      shares: 1_000,
      lots: 1,
      weight: 95
    });
  });

  it("detects the valuation date from the XLSX base64 snapshot", () => {
    expect(detectJpmorganPcfTradeDate(rawBody)).toBe("2026-05-18");
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "jpmorgan",
      etfCode: "00401A",
      tradeDate: "2026-05-18",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(parseJpmorganHoldings(rawBody)).toHaveLength(2);
    expect(parseJpmorganSummary(rawBody).stockRatio).toBe(100);
    expect(normalizeJpmorganHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00401A",
      tradeDate: "2026-05-18",
      sourceProvider: "jpmorgan"
    });
    expect(normalizeJpmorganSummary(summaryRaw)).toMatchObject({
      etfCode: "00401A",
      tradeDate: "2026-05-18",
      sourceProvider: "jpmorgan"
    });
  });
});
