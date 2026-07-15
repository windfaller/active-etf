import type { GlobalEtfConfig } from "../../config/globalEtfs.js";
import { mappedTickerForSec13fCusip } from "../../config/globalHoldingTickerMap.js";
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
  const namedMonth = text.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/u);
  if (namedMonth) {
    const [, day, monthName, year] = namedMonth;
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.toLowerCase());
    if (month >= 0) return `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const namedMonthFirst = text.match(/([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})/u);
  if (namedMonthFirst) {
    const [, monthName, day, year] = namedMonthFirst;
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.toLowerCase());
    if (month >= 0) return `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
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

function normalizeExchangeTicker(ticker: string | undefined): string | undefined {
  if (!ticker) return undefined;
  const normalized = ticker.trim().replace(/\s+/gu, " ");
  const exchangeMatch = normalized.match(/^(.+?)\s+(KS|TT|JP|US)$/u);
  if (!exchangeMatch) return normalized;

  const [, symbol, exchange] = exchangeMatch;
  if (exchange === "KS") return `${symbol}.KS`;
  if (exchange === "TT") return `${symbol}.TW`;
  if (exchange === "JP") return `${symbol}.JP`;
  if (exchange === "US") return symbol;
  return normalized;
}

function normalizeRoundhillDramHolding(row: CsvRow): {
  ticker?: string;
  name: string;
  identifier?: string;
  assetType: string;
} {
  const rawTicker = stringFrom(row.StockTicker);
  const displayTicker = normalizeExchangeTicker(rawTicker);
  const rawName = stringFrom(row.SecurityName) ?? rawTicker ?? "Unknown";
  const upperName = rawName.toUpperCase();
  const isCash =
    row.MoneyMarketFlag?.trim().toUpperCase() === "Y" ||
    upperName.includes("TREASURY BILL") ||
    upperName.includes("GOVERNMENT OBLIGATIONS FUND") ||
    upperName.includes("WON") ||
    upperName.includes("DOLLAR") ||
    ["KRW", "TWD", "USD", "JPY"].includes(rawTicker ?? "");

  if (isCash) {
    return {
      ticker: displayTicker,
      name: rawName,
      identifier: stringFrom(row.CUSIP),
      assetType: "Cash"
    };
  }

  if (upperName.includes("MICRON") && (upperName.includes("SWAP") || rawTicker?.includes("TRS"))) {
    return {
      ticker: "MU",
      name: "Micron Technology Inc",
      identifier: "MU",
      assetType: "Equity Swap"
    };
  }

  if (upperName.includes("SK HYNIX")) {
    return {
      ticker: "SKHY",
      name: "SK Hynix Inc",
      identifier: "SKHY",
      assetType: upperName.includes("SWAP") || rawTicker?.includes("TRS") ? "Equity Swap" : "Equity"
    };
  }

  if (upperName.includes("SAMSUNG ELECTRONICS") && (upperName.includes("SWAP") || rawTicker?.includes("TRS"))) {
    return {
      ticker: "005930.KS",
      name: "Samsung Electronics Co Ltd",
      identifier: "005930.KS",
      assetType: "Equity Swap"
    };
  }

  if (upperName.includes("KIOXIA") && (upperName.includes("SWAP") || rawTicker?.includes("TRS"))) {
    return {
      ticker: "285A.JP",
      name: "Kioxia Holdings Corp",
      identifier: "285A.JP",
      assetType: "Equity Swap"
    };
  }

  return {
    ticker: displayTicker,
    name: rawName,
    identifier: displayTicker,
    assetType: "Equity"
  };
}

export function parseRoundhillDramCsv(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const rows = parseCsv(raw);
  const filtered = rows.filter((row) => row.Account?.trim().toUpperCase() === "DRAM");
  const sourceAsOf = dateOnly(filtered[0]?.Date ?? rows[0]?.Date);
  const holdings = filtered.map((row) => {
    const normalized = normalizeRoundhillDramHolding(row);
    return buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ...normalized,
      weightPercent: numberFrom(row.Weightings),
      shares: numberFrom(row.Shares),
      marketValue: numberFrom(row.MarketValue)
    });
  });

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}

export function parseTemaNasaCsv(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const rows = parseCsv(raw);
  const sourceAsOf = dateOnly(rows[0]?.holdings_date);
  const holdings = rows.map((row) =>
    buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker: normalizeTemaTicker(stringFrom(row.ticker), stringFrom(row.proper_name)),
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

function normalizeTemaTicker(ticker: string | undefined, name: string | undefined): string | undefined {
  const normalized = ticker?.trim();
  if (!normalized) return undefined;
  const upperTicker = normalized.toUpperCase();
  const upperName = name?.toUpperCase() ?? "";
  if (upperTicker.endsWith(" SPV") || upperName.includes("SPV EXPOSURE")) return undefined;
  return normalizeExchangeTicker(normalized);
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gsu, "$1")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#39;/gu, "'")
    .trim();
}

function stripHtml(value: string): string {
  return decodeXmlText(value.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " "));
}

function isCashLike(input: { ticker?: string; name?: string; assetType?: string }): boolean {
  const ticker = input.ticker?.trim().toUpperCase();
  const name = input.name?.trim().toUpperCase() ?? "";
  const assetType = input.assetType?.trim().toUpperCase() ?? "";
  return assetType.includes("CASH") || name.includes("CASH") || name.includes("TREASURY") || ticker === "USD" || ticker === "CASH&OTHER";
}

export function sanitizeSpreadsheetXml(raw: string): string {
  return raw
    .replace(/<\/?strong>/giu, "")
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[a-f0-9]+;)/giu, "&amp;");
}

function extractWorksheet(raw: string, name: string): string {
  const openMatch = new RegExp(`<(?:\\w+:)?Worksheet[^>]+(?:\\w+:)?Name="${name}"[^>]*>`, "u").exec(raw);
  if (!openMatch) return raw;

  const bodyStart = openMatch.index + openMatch[0].length;
  const closeTags = ["</ss:Worksheet>", "</Worksheet>"]
    .map((tag) => ({ tag, index: raw.indexOf(tag, bodyStart) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  const close = closeTags[0];
  if (!close) return raw.slice(openMatch.index);
  return raw.slice(openMatch.index, close.index + close.tag.length);
}

function spreadsheetRows(raw: string): string[][] {
  const xml = sanitizeSpreadsheetXml(raw);
  const worksheet = extractWorksheet(xml, "Holdings");
  const rows = [...worksheet.matchAll(/<(?:\w+:)?Row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Row>/gu)];

  return rows.map((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<(?:\w+:)?Cell\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Cell>/gu)];
    const values: string[] = [];
    for (const cell of cells) {
      const indexAttr = cell[1].match(/(?:\w+:)?Index="(\d+)"/u)?.[1];
      if (indexAttr) {
        while (values.length < Number(indexAttr) - 1) values.push("");
      }
      const data = cell[2].match(/<(?:\w+:)?Data\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Data>/u)?.[1] ?? "";
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
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => cell.trim());
    return headers.includes("Name") && headers.includes("Weight (%)") && headers.includes("Asset Class");
  });
  const headers = rows[headerIndex] ?? [];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim())) : [];
  const rowObjects = dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  const holdings = rowObjects
    .filter((row) => stringFrom(row.Name) && numberFrom(row["Weight (%)"]) !== undefined)
    .map((row) => buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker: stringFrom(row.Ticker),
      name: stringFrom(row.Name) ?? stringFrom(row.Ticker) ?? "Unknown",
      sector: stringFrom(row.Sector),
      assetType: stringFrom(row["Asset Class"]),
      marketValue: numberFrom(row["Market Value"]),
      weightPercent: numberFrom(row["Weight (%)"]),
      notionalValue: numberFrom(row["Notional Value"]),
      shares: numberFrom(row.Shares) ?? numberFrom(row.Quantity),
      parValue: numberFrom(row["Par Value"]),
      price: numberFrom(row.Price),
      country: stringFrom(row.Location)
    }));

  return { sourceAsOf, rawRowCount: holdings.length, holdings };
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

export function parseTuttleNavstarHoldingsJson(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const body = JSON.parse(raw) as { holdings?: unknown[] };
  const rows = (body.holdings ?? []).filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
  const latestDate = rows
    .map((row) => dateOnly(row.as_of_date))
    .filter(Boolean)
    .sort()
    .at(-1);
  const sourceAsOf = latestDate ?? "";
  const latestRows = rows.filter((row) => dateOnly(row.as_of_date) === sourceAsOf);
  const holdings = latestRows.map((row) => {
    const ticker = stringFrom(row.security_ticker);
    const name = stringFrom(row.security_name) ?? ticker ?? "Unknown";
    const assetType = stringFrom(row.asset_class) ?? (isCashLike({ ticker, name }) ? "Cash" : "Equity");
    return buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker,
      name,
      identifier: stringFrom(row.security_id),
      weightPercent: numberFrom(row.weight),
      shares: numberFrom(row.quantity),
      marketValue: numberFrom(row.market_value),
      country: stringFrom(row.country),
      sector: stringFrom(row.sector),
      assetType
    });
  });

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}

export function parseJanusHendersonFullHoldingsHtml(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const sourceAsOf = dateOnly(
    raw.match(/As of\s*<span[^>]*>([^<]+)<\/span>/iu)?.[1] ?? raw.match(/\(As of\s*([^)]+)\)/iu)?.[1]
  );
  const table = raw.match(/<table[^>]+id=["']full_holdings["'][^>]*>([\s\S]*?)<\/table>/iu)?.[1] ?? raw;
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)]
    .map((rowMatch) => {
      const cells: Record<string, string> = {};
      for (const cellMatch of rowMatch[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/giu)) {
        const key = cellMatch[1].match(/data-key-([A-Za-z0-9_-]+)/u)?.[1];
        const value = stripHtml(cellMatch[2]);
        if (key) cells[key] = value;
        else if (value && !cells.name) cells.name = value;
      }
      return cells;
    })
    .filter((row) => Object.keys(row).length > 0);

  const holdings = rows
    .filter((row) => stringFrom(row.underlyingSecurity) || stringFrom(row.ticker))
    .map((row) => {
      const ticker = normalizeExchangeTicker(stringFrom(row.ticker));
      const name = stringFrom(row.underlyingSecurity) ?? stringFrom(row.name) ?? ticker ?? "Unknown";
      return buildHolding(etf, sourceAsOf, sourceUrl, row, {
        ticker,
        name,
        identifier: stringFrom(row.cusip),
        weightPercent: numberFrom(row.percentOfPortfolio),
        shares: numberFrom(row.quantity),
        marketValue: numberFrom(row.marketValue) ?? numberFrom(row.currentMarketValue),
        notionalValue: numberFrom(row.notionalValue),
        assetType: isCashLike({ ticker, name }) ? "Cash" : "Equity"
      });
    });

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}

export function parseAlgerDailyHoldingsCsv(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const rows = parseCsv(raw);
  const filtered = rows.filter((row) => (stringFrom(row["Product Short Name"]) ?? etf.etfCode).toUpperCase() === etf.etfCode);
  const sourceAsOf = dateOnly(filtered[0]?.["Effective Date"] ?? rows[0]?.["Effective Date"]);
  const holdings = filtered.map((row) => {
    const ticker = stringFrom(row.Ticker);
    const name = stringFrom(row["Security Description"]) ?? ticker ?? "Unknown";
    return buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker,
      name,
      identifier: stringFrom(row.CUSIP),
      weightPercent: numberFrom(row["Percentage Weight"]),
      shares: numberFrom(row.Quantity),
      marketValue: numberFrom(row["Market Value"]),
      assetType: isCashLike({ ticker, name }) ? "Cash" : "Equity"
    });
  });

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}

export function parseAllianceBernsteinUsTopHoldingsJson(raw: string, etf: GlobalEtfConfig, sourceUrl: string): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const body = JSON.parse(raw) as {
    domesticHoldings?: Array<{
      asOfDate?: string;
      holdingCategory?: string;
      holdings?: Array<Record<string, unknown>>;
    }>;
  };
  const topTenSection = body.domesticHoldings?.find((section) => section.holdingCategory?.toLowerCase().includes("top ten"));
  const rows = (topTenSection?.holdings ?? []).filter((row) => stringFrom(row.holding)?.toUpperCase() !== "TOTAL");
  const sourceAsOf = dateOnly(topTenSection?.asOfDate);
  const holdings = rows.map((row) => {
    const name = stringFrom(row.holding) ?? "Unknown";
    return buildHolding(etf, sourceAsOf, sourceUrl, row, {
      name,
      sector: stringFrom(row.classification),
      weightPercent: numberFrom(row.holdingPerc),
      shares: numberFrom(row.holdingShares),
      marketValue: numberFrom(row.holdingValue),
      identifier: stringFrom(row.holdingCode),
      assetType: isCashLike({ name }) ? "Cash" : "Equity"
    });
  });

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}

function xmlText(block: string, tagName: string): string | undefined {
  const match = new RegExp(`<[^:>/]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^:>]*:?${tagName}>`, "iu").exec(block);
  return match ? decodeXmlText(match[1].replace(/<[^>]+>/gu, "")) : undefined;
}

export function parseSec13fInformationTable(
  raw: string,
  etf: GlobalEtfConfig,
  sourceUrl: string,
  sourceAsOf: string
): { sourceAsOf: string; rawRowCount: number; holdings: GlobalEtfHolding[] } {
  const rows = [...raw.matchAll(/<[^:>/]*:?infoTable\b[^>]*>([\s\S]*?)<\/[^:>]*:?infoTable>/giu)].map((match) => match[1]);
  const rawHoldings = rows
    .map((row) => ({
      name: stringFrom(xmlText(row, "nameOfIssuer")),
      titleOfClass: stringFrom(xmlText(row, "titleOfClass")),
      cusip: stringFrom(xmlText(row, "cusip")),
      value: numberFrom(xmlText(row, "value")),
      shares: numberFrom(xmlText(row, "sshPrnamt")),
      shareType: stringFrom(xmlText(row, "sshPrnamtType"))
    }))
    .filter((row) => row.name && row.value !== undefined);
  const totalValue = rawHoldings.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const holdings = rawHoldings.map((row) =>
    buildHolding(etf, sourceAsOf, sourceUrl, row, {
      ticker: mappedTickerForSec13fCusip(row.cusip)?.ticker,
      name: row.name ?? "Unknown",
      identifier: row.cusip,
      weightPercent: totalValue > 0 && row.value !== undefined ? (row.value / totalValue) * 100 : undefined,
      shares: row.shares,
      marketValue: row.value,
      assetType: row.shareType === "PRN" ? "Fixed Income" : "Equity",
      industry: row.titleOfClass
    })
  );

  return { sourceAsOf, rawRowCount: rows.length, holdings };
}
