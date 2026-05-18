import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { detectCathayTradeDate, parseCathayHoldings, parseCathaySummary } from "../../src/providers/cathay/parser.js";

function localZipEntry(name: string, body: string): Buffer {
  const nameBuffer = Buffer.from(name);
  const bodyBuffer = Buffer.from(body);
  const compressed = deflateRawSync(bodyBuffer);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(0, 10);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(bodyBuffer.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuffer, compressed]);
}

function si(value: string): string {
  return `<si><t xml:space="preserve">${value}</t></si>`;
}

function cell(ref: string, valueIndex: number): string {
  return `<c r="${ref}" t="s"><v>${valueIndex}</v></c>`;
}

function row(index: number, values: Array<string | null>): string {
  const cells = values
    .map((value, columnIndex) => (value === null ? "" : cell(`${String.fromCharCode(65 + columnIndex)}${index}`, strings.indexOf(value))))
    .join("");
  return `<row r="${index}">${cells}</row>`;
}

const strings = [
  "國泰台股動能高息主動式ETF基金",
  "2026/05/15基金持股權重",
  "基金資產",
  "基金淨資產價值",
  "NT$20,429,861,823",
  "基金在外流通單位數",
  "1,543,640,000",
  "基金每單位淨值",
  "NT$13.23",
  "其他資產",
  "項目",
  "金額",
  "現金",
  "(TWD) $ 271,887,685",
  "股票",
  "NT$20,155,370,600",
  "股票代號",
  "股票名稱",
  "股數",
  "持股權重",
  "2330",
  "台積電",
  "770,000",
  "8.54%",
  "2454",
  "聯發科",
  "517,000",
  "8.25%",
  "期貨"
];

function workbookBase64(): string {
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8"?><sst>${strings.map(si).join("")}</sst>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${[
    row(1, ["國泰台股動能高息主動式ETF基金"]),
    row(2, ["2026/05/15基金持股權重"]),
    row(3, ["基金資產"]),
    row(4, ["基金淨資產價值", "NT$20,429,861,823"]),
    row(5, ["基金在外流通單位數", "1,543,640,000"]),
    row(6, ["基金每單位淨值", "NT$13.23"]),
    row(8, ["其他資產"]),
    row(9, ["項目", "金額"]),
    row(10, ["現金", "(TWD) $ 271,887,685"]),
    row(12, ["股票", "NT$20,155,370,600"]),
    row(14, ["股票代號", "股票名稱", "股數", "持股權重"]),
    row(15, ["2330", "台積電", "770,000", "8.54%"]),
    row(16, ["2454", "聯發科", "517,000", "8.25%"]),
    row(17, ["期貨"])
  ].join("")}</sheetData></worksheet>`;

  return Buffer.concat([
    localZipEntry("xl/sharedStrings.xml", sharedStrings),
    localZipEntry("xl/worksheets/sheet1.xml", sheet)
  ]).toString("base64");
}

describe("Cathay parser", () => {
  const rawBody = workbookBase64();

  it("detects workbook trade date", () => {
    expect(detectCathayTradeDate(rawBody)).toBe("2026-05-15");
  });

  it("parses summary", () => {
    expect(parseCathaySummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 13.23,
      totalUnits: 1543640000,
      fundSize: 20429861823,
      cashRatio: 1.3308,
      stockRatio: 98.6564
    });
  });

  it("parses stock holdings", () => {
    expect(parseCathayHoldings(rawBody)).toEqual([
      {
        stockId: "2330",
        stockName: "台積電",
        shares: 770000,
        lots: 770,
        weight: 8.54,
        marketValue: 1744710199.68
      },
      {
        stockId: "2454",
        stockName: "聯發科",
        shares: 517000,
        lots: 517,
        weight: 8.25,
        marketValue: 1685463600.4
      }
    ]);
  });
});
