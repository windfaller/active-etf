import { inflateRawSync } from "node:zlib";
import { round } from "../../utils/number.js";

export interface ParsedCathayHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedCathaySummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  cashRatio: number | null;
  stockRatio: number | null;
}

interface ZipEntry {
  name: string;
  body: Buffer;
}

type SheetRow = Record<string, string>;

function xmlText(value: string): string {
  return value
    .replace(/^\uFEFF/u, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const bodyStart = nameStart + fileNameLength + extraLength;
    const bodyEnd = bodyStart + compressedSize;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const compressed = buffer.subarray(bodyStart, bodyEnd);

    if (method === 0) {
      entries.push({ name, body: compressed });
    } else if (method === 8) {
      entries.push({ name, body: inflateRawSync(compressed) });
    }

    offset = bodyEnd;
  }

  return entries;
}

function sharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/gu)].map((match) => {
    const textParts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gu)].map((part) => part[1]);
    return xmlText(textParts.join(""));
  });
}

function columnFromCellRef(cellRef: string): string {
  return cellRef.replace(/\d+$/u, "");
}

function parseSheetRows(xml: string, strings: string[]): SheetRow[] {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gu)].map((rowMatch) => {
    const row: SheetRow = {};

    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gu)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = /r="([^"]+)"/u.exec(attrs)?.[1];
      const value = /<v>([\s\S]*?)<\/v>/u.exec(body)?.[1];
      if (!ref || value === undefined) continue;

      const column = columnFromCellRef(ref);
      row[column] = attrs.includes('t="s"') ? strings[Number(value)] ?? "" : xmlText(value);
    }

    return row;
  });
}

function parseWorkbook(rawBody: string): SheetRow[] {
  const buffer = Buffer.from(rawBody, "base64");
  if (buffer.length === 0 || buffer.subarray(0, 2).toString("utf8") !== "PK") {
    throw new Error("Cathay XLSX response is empty or not a ZIP workbook");
  }

  const entries = extractZipEntries(buffer);
  const sharedStringsXml = entries.find((entry) => entry.name === "xl/sharedStrings.xml")?.body.toString("utf8");
  const sheetXml = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml")?.body.toString("utf8");
  if (!sharedStringsXml || !sheetXml) {
    throw new Error("Cathay XLSX is missing sharedStrings.xml or sheet1.xml");
  }

  return parseSheetRows(sheetXml, sharedStrings(sharedStringsXml));
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/NT\$|\$|TWD|\(|\)|,|%|\s/gu, "").trim();
  if (!normalized || normalized === "-") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTradeDate(value: string | undefined): string {
  const match = value?.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/u);
  if (!match) {
    throw new Error("Cathay XLSX is missing trade date");
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function valueAfterLabel(rows: SheetRow[], labelPattern: RegExp): string | undefined {
  return rows.find((row) => labelPattern.test(row.A ?? ""))?.B;
}

export function detectCathayTradeDate(rawBody: string): string {
  const rows = parseWorkbook(rawBody);
  return parseTradeDate(rows.find((row) => /基金持股權重/u.test(row.A ?? ""))?.A);
}

export function parseCathayHoldings(rawBody: string): ParsedCathayHolding[] {
  const rows = parseWorkbook(rawBody);
  const fundSize = parseNumber(valueAfterLabel(rows, /基金淨資產價值/u));
  const headerIndex = rows.findIndex((row) => row.A === "股票代號" && row.B === "股票名稱");
  if (headerIndex < 0) {
    throw new Error("Cathay XLSX is missing stock holdings header");
  }

  return rows
    .slice(headerIndex + 1)
    .filter((row) => /^\d{4}$/u.test(row.A ?? ""))
    .map((row) => {
      const shares = parseNumber(row.C) ?? 0;
      const weight = parseNumber(row.D);

      return {
        stockId: row.A.trim(),
        stockName: (row.B ?? "").replace(/\s+/gu, " ").trim(),
        shares,
        lots: shares / 1000,
        weight,
        marketValue: fundSize !== null && weight !== null ? round((fundSize * weight) / 100, 2) : null
      };
    })
    .filter((holding) => holding.stockName);
}

export function parseCathaySummary(rawBody: string): ParsedCathaySummary {
  const rows = parseWorkbook(rawBody);
  const fundSize = parseNumber(valueAfterLabel(rows, /基金淨資產價值/u));
  const cashValue = parseNumber(valueAfterLabel(rows, /^現金$/u));
  const stockValue = parseNumber(valueAfterLabel(rows, /^股票$/u));

  return {
    tradeDate: parseTradeDate(rows.find((row) => /基金持股權重/u.test(row.A ?? ""))?.A),
    nav: parseNumber(valueAfterLabel(rows, /基金每單位淨值/u)),
    totalUnits: parseNumber(valueAfterLabel(rows, /基金在外流通單位數/u)),
    fundSize,
    cashRatio: fundSize !== null && cashValue !== null ? round((cashValue / fundSize) * 100) : null,
    stockRatio: fundSize !== null && stockValue !== null ? round((stockValue / fundSize) * 100) : null
  };
}
