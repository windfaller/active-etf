import type { GlobalEtfConfig } from "../../config/globalEtfs.js";
import type { GlobalEtfHolding } from "../../models/GlobalEtf.js";

type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

export function parseCsv(raw: string): CsvRow[] {
  const lines = raw
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
  });
}

function numberFrom(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!text || text === "-" || text.toLowerCase() === "nan") return undefined;
  const negative = /^\(.+\)$/u.test(text);
  const cleaned = text.replace(/[,$%()]/gu, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return undefined;
  return negative ? -parsed : parsed;
}

function stringFrom(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function dateOnly(value: unknown): string {
  const text = String(value ?? "").trim();
  const iso = text.match(/\d{4}-\d{2}-\d{2}/u)?.[0];
  if (iso) return iso;
  const us = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/u);
  if (us) {
    const [, month, day, year] = us;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return text.slice(0, 10);
}

export function positionKeyFor(input: { identifier?: string; ticker?: string; name: string }): string {
  if (input.identifier) return `id:${input.identifier.toUpperCase()}`;
  if (input.ticker) return `ticker:${input.ticker.toUpperCase()}`;
  return `name:${input.name.trim().toUpperCase().replace(/\s+/gu, " ")}`;
}

function buildHolding(
  etf: GlobalEtfConfig,
  sourceAsOf: string,
  sourceUrl: string,
  raw: unknown,
  values: Omit<GlobalEtfHolding, "etfCode" | "fundName" | "issuer" | "sourceAsOf" | "fetchedAt" | "sourceUrl" | "sourceStatus" | "productGroup" | "market" | "strategyType" | "positionKey" | "raw">
): GlobalEtfHolding {
  const name = values.name.trim();
  const ticker = values.ticker?.trim().toUpperCase();
  const identifier = values.identifier?.trim().toUpperCase();

  return {
    ...values,
    ticker,
    identifier,
    name,
    etfCode: etf.etfCode,
    fundName: etf.fundName,
    issuer: etf.issuer,
    sourceAsOf,
    fetchedAt: new Date(),
    sourceUrl,
    sourceStatus: "ok",
    productGroup: "global_etf",
    market: "US",
    strategyType: etf.strategyType,
    positionKey: positionKeyFor({ identifier, ticker, name }),
    raw
  };
}

export function parseRoundhillDramCsv(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const rows = parseCsv(raw);
  const filtered = rows.filter((row) => row.Account?.trim().toUpperCase() === "DRAM");
  const sourceAsOf = dateOnly(filtered[0]?.Date ?? rows[0]?.Date);
  const holdings = filtered.map((row) =>
    buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker: stringFrom(row.StockTicker),
      name: stringFrom(row.SecurityName) ?? stringFrom(row.StockTicker) ?? "Unknown",
      identifier: stringFrom(row.CUSIP),
      weightPercent: numberFrom(row.Weightings),
      shares: numberFrom(row.Shares),
      marketValue: numberFrom(row.MarketValue),
      assetType: row.MoneyMarketFlag?.trim().toUpperCase() === "Y" ? "Cash" : "Equity"
    })
  );

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}

export function parseTemaNasaCsv(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const rows = parseCsv(raw);
  const sourceAsOf = dateOnly(rows[0]?.holdings_date);
  const holdings = rows.map((row) =>
    buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker: stringFrom(row.ticker),
      name: stringFrom(row.proper_name) ?? stringFrom(row.ticker) ?? "Unknown",
      identifier: stringFrom(row.cusip),
      weightPercent: (numberFrom(row.percent_of_nav) ?? 0) * 100,
      shares: numberFrom(row.shares),
      marketValue: numberFrom(row.market_value),
      country: stringFrom(row.country),
      sector: stringFrom(row.sector),
      assetType: row.is_cash?.trim() === "1" ? "Cash" : "Equity"
    })
  );

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gsu, "$1")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .trim();
}

export function sanitizeSpreadsheetXml(raw: string): string {
  return raw
    .replace(/<\/?strong>/giu, "")
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[a-f0-9]+;)/giu, "&amp;");
}

function spreadsheetRows(raw: string): string[][] {
  const xml = sanitizeSpreadsheetXml(raw);
  const worksheet =
    xml.match(/<Worksheet[^>]+ss:Name="Holdings"[\s\S]*?<\/Worksheet>/u)?.[0] ??
    xml.match(/<Worksheet[^>]+Name="Holdings"[\s\S]*?<\/Worksheet>/u)?.[0] ??
    xml;
  const rows = [...worksheet.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/gu)];

  return rows.map((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<Cell\b([^>]*)>([\s\S]*?)<\/Cell>/gu)];
    const values: string[] = [];
    for (const cell of cells) {
      const indexAttr = cell[1].match(/ss:Index="(\d+)"/u)?.[1];
      if (indexAttr) {
        while (values.length < Number(indexAttr) - 1) values.push("");
      }
      const data = cell[2].match(/<Data\b[^>]*>([\s\S]*?)<\/Data>/u)?.[1] ?? "";
      values.push(decodeXmlText(data.replace(/<[^>]+>/gu, "")));
    }
    return values;
  });
}

export function parseBlackRockBaiSpreadsheet(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const rows = spreadsheetRows(raw);
  const sourceAsOf =
    dateOnly(rows.find((row) => row.some((cell) => cell.toLowerCase() === "fund holdings as of"))?.find((cell) => /\d/u.test(cell))) ||
    dateOnly(rows.find((row) => row[0]?.toLowerCase() === "fund holdings as of")?.[1]);
  const headerIndex = rows.findIndex((row) => row.map((cell) => cell.trim()).join("|").startsWith("Ticker|Name|Sector|Asset Class"));
  const headers = rows[headerIndex] ?? [];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim())) : [];
  const rowObjects = dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  const holdings = rowObjects.map((row) =>
    buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker: stringFrom(row.Ticker),
      name: stringFrom(row.Name) ?? stringFrom(row.Ticker) ?? "Unknown",
      sector: stringFrom(row.Sector),
      assetType: stringFrom(row["Asset Class"]),
      marketValue: numberFrom(row["Market Value"]),
      weightPercent: numberFrom(row["Weight (%)"]),
      notionalValue: numberFrom(row["Notional Value"]),
      shares: numberFrom(row.Shares),
      price: numberFrom(row.Price),
      country: stringFrom(row.Location)
    })
  );

  return { sourceAsOf, rawRowCount: rowObjects.length, holdings };
}

export function parseCorgiEuvRows(rows: unknown[], etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const objects = rows.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
  const latestDate = objects
    .map((row) => dateOnly(row.holding_date))
    .filter(Boolean)
    .sort()
    .at(-1);
  const latestRows = objects.filter((row) => dateOnly(row.holding_date) === latestDate);
  const sourceAsOf = latestDate ?? "";
  const holdings = latestRows.map((row) =>
    buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker: stringFrom(row.stock_ticker),
      name: stringFrom(row.security_name) ?? stringFrom(row.stock_ticker) ?? "Unknown",
      identifier: stringFrom(row.cusip),
      weightPercent: numberFrom(row.weightings),
      shares: numberFrom(row.shares),
      price: numberFrom(row.price),
      marketValue: numberFrom(row.market_value),
      assetType: String(row.money_market_flag ?? "").trim().toUpperCase() === "Y" ? "Cash" : "Equity"
    })
  );

  return { sourceAsOf, rawRowCount: objects.length, holdings };
}
