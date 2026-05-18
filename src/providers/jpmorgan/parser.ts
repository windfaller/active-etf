import { inflateRawSync } from "node:zlib";

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

export interface ParsedJpmorganHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedJpmorganSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  componentCount: number | null;
  stockRatio: number | null;
}

interface JpmorganPcfWorkbook {
  summary: ParsedJpmorganSummary;
  holdings: ParsedJpmorganHolding[];
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function readAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decodeXml(match[1]) : null;
}

function columnIndex(cellRef: string): number {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0].toUpperCase();
  if (!letters) return 0;

  return [...letters].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }

  throw new Error("JPMorgan XLSX end of central directory was not found");
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("JPMorgan XLSX central directory is malformed");
    }

    const nameLength = buffer.readUInt16LE(offset + 28);
    const entry: ZipEntry = {
      compressionMethod: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
      name: buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8")
    };
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);

    if (buffer.readUInt32LE(entry.localHeaderOffset) !== 0x04034b50) {
      throw new Error(`JPMorgan XLSX local header is malformed: ${entry.name}`);
    }

    const localNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
    const dataOffset = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

    if (entry.compressionMethod === 0) {
      entries.set(entry.name, compressed);
    } else if (entry.compressionMethod === 8) {
      entries.set(entry.name, inflateRawSync(compressed));
    } else {
      throw new Error(`Unsupported JPMorgan XLSX compression method: ${entry.compressionMethod}`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]))
      .join("")
  );
}

function parseWorksheet(xml: string, sharedStrings: string[]): string[][] {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const cells: string[] = [];
    const rowXml = rowMatch[1];
    const cellRegex = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const attrs = cellMatch[1] ?? cellMatch[2] ?? "";
      const ref = readAttr(attrs, "r");
      if (!ref) continue;

      const value = (cellMatch[3] ?? "").match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const type = readAttr(attrs, "t");
      const parsed = type === "s" ? sharedStrings[Number(value)] ?? "" : decodeXml(value);
      cells[columnIndex(ref)] = parsed;
    }

    return Array.from({ length: cells.length }, (_, index) => cells[index] ?? "");
  });
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  const slash = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const match = compact ?? slash;

  if (!match) {
    throw new Error(`Unsupported JPMorgan valuation date format: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function indexByHeader(row: string[]): Map<string, number> {
  return new Map(row.map((header, index) => [header.trim(), index]));
}

function requiredIndex(headers: Map<string, number>, header: string): number {
  const index = headers.get(header);
  if (index === undefined) {
    throw new Error(`JPMorgan PCF header was not found: ${header}`);
  }

  return index;
}

export function parseJpmorganPcfRows(rows: string[][]): JpmorganPcfWorkbook {
  const summaryHeaders = indexByHeader(rows[0] ?? []);
  const summaryRow = rows[1] ?? [];
  const holdingHeaders = indexByHeader(rows[2] ?? []);

  const tradeDate = toIsoDate(summaryRow[requiredIndex(summaryHeaders, "Valuation Date")]);
  const fundSize = toNumber(summaryRow[requiredIndex(summaryHeaders, "Estimated NAV")]);
  const holdings = rows
    .slice(3)
    .map((row) => {
      const recordType = row[requiredIndex(holdingHeaders, "Record Type")]?.trim();
      const constituentType = row[requiredIndex(holdingHeaders, "Constituent Type")]?.trim();
      const ticker = row[requiredIndex(holdingHeaders, "Constituent Ticker")]?.trim();

      if (recordType !== "D" || constituentType !== "Equity" || !/^\d{4}$/.test(ticker)) {
        return null;
      }

      const shares = toNumber(row[requiredIndex(holdingHeaders, "Shares or PAR Amount")]) ?? 0;
      const marketValue = toNumber(row[requiredIndex(holdingHeaders, "Market Value Base")]);

      return {
        stockId: ticker,
        stockName: row[requiredIndex(holdingHeaders, "Constituent Description")]?.trim() ?? "",
        shares,
        lots: shares / 1000,
        weight: fundSize && marketValue !== null ? (marketValue / fundSize) * 100 : null,
        marketValue
      };
    })
    .filter((holding): holding is ParsedJpmorganHolding => holding !== null && holding.stockName !== "");

  const stockValue = holdings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0);

  return {
    summary: {
      tradeDate,
      nav: toNumber(summaryRow[requiredIndex(summaryHeaders, "Estimated NAV per Share")]),
      totalUnits: toNumber(summaryRow[requiredIndex(summaryHeaders, "Outstanding Shares")]),
      fundSize,
      componentCount: toNumber(summaryRow[requiredIndex(summaryHeaders, "Component Count")]),
      stockRatio: fundSize ? (stockValue / fundSize) * 100 : null
    },
    holdings
  };
}

export function parseJpmorganPcf(rawBody: string): JpmorganPcfWorkbook {
  const buffer = Buffer.from(rawBody, "base64");
  if (buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("JPMorgan PCF body is not an XLSX base64 payload");
  }

  const entries = readZipEntries(buffer);
  const sharedStrings = entries.get("xl/sharedStrings.xml");
  const sheet = entries.get("xl/worksheets/sheet1.xml");
  if (!sharedStrings || !sheet) {
    throw new Error("JPMorgan PCF workbook is missing required worksheet files");
  }

  return parseJpmorganPcfRows(parseWorksheet(sheet.toString("utf8"), parseSharedStrings(sharedStrings.toString("utf8"))));
}

export function detectJpmorganPcfTradeDate(rawBody: string): string {
  return parseJpmorganPcf(rawBody).summary.tradeDate;
}

export function parseJpmorganHoldings(rawBody: string): ParsedJpmorganHolding[] {
  return parseJpmorganPcf(rawBody).holdings;
}

export function parseJpmorganSummary(rawBody: string): ParsedJpmorganSummary {
  return parseJpmorganPcf(rawBody).summary;
}
