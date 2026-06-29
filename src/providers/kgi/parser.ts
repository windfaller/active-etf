function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string): number | null {
  const normalized = stripHtml(value)
    .replace(/TWD|\$|,|%/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();

  if (!normalized || normalized === "-") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string): string {
  const match = stripHtml(value).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) {
    throw new Error(`Unsupported KGI date format: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function readInputValue(rawBody: string, id: string): string | null {
  const inputMatch = rawBody.match(new RegExp(`<input[^>]+id=["']${id}["'][^>]*>`, "i"));
  if (!inputMatch) return null;

  const valueMatch = inputMatch[0].match(/\bvalue=["']([^"']*)["']/i);
  return valueMatch ? decodeHtml(valueMatch[1]) : null;
}

function readSummaryRows(rawBody: string): Array<{ label: string; value: string }> {
  const listMatch = rawBody.match(/<ul[^>]*class=["'][^"']*\bRedemption\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
  if (!listMatch) {
    throw new Error("KGI redemption summary list was not found");
  }

  const rows = listMatch[1].match(/<li[\s\S]*?<\/li>/gi) ?? [];
  return rows
    .map((row) => {
      const spans = [...row.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((match) => stripHtml(match[1]));
      if (spans.length < 2) return null;
      return { label: spans[0], value: spans[1] };
    })
    .filter((row): row is { label: string; value: string } => row !== null);
}

function findSummaryValue(rawBody: string, labelPattern: RegExp): string | null {
  return readSummaryRows(rawBody).find((row) => labelPattern.test(row.label))?.value ?? null;
}

function findNavLabelDate(rawBody: string): string | null {
  const label = readSummaryRows(rawBody).find((row) => /每受益權單位淨資產價值/u.test(row.label))?.label;
  return label?.match(/\((\d{4}[-/]\d{1,2}[-/]\d{1,2})\)/)?.[1] ?? null;
}

function readStockTableBody(rawBody: string): string {
  const stockHeader =
    /<th[^>]*>\s*(?:&#x80A1;&#x7968;&#x4EE3;&#x865F;|股票代號)\s*<\/th>\s*<th[^>]*>\s*(?:&#x80A1;&#x7968;&#x540D;&#x7A31;|股票名稱)\s*<\/th>\s*<th[^>]*>\s*(?:&#x80A1;&#x6578;|股數)\s*<\/th>\s*<th[^>]*>\s*(?:&#x6B0A;&#x91CD;\(%\)|權重\(%\))\s*<\/th>/i;
  const headerMatch = stockHeader.exec(rawBody);

  if (!headerMatch) {
    throw new Error("KGI redemption stock table header was not found");
  }

  const afterHeader = rawBody.slice(headerMatch.index + headerMatch[0].length);
  const bodyMatch = afterHeader.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) {
    throw new Error("KGI redemption stock table body was not found");
  }

  return bodyMatch[1];
}

export interface ParsedKgiHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedKgiSummary {
  tradeDate: string;
  announcementDate: string | null;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
}

export function detectKgiPcfTradeDate(rawBody: string): string {
  const navDate = findNavLabelDate(rawBody);
  if (navDate) return toIsoDate(navDate);

  const dataDate = readInputValue(rawBody, "DataDate");
  if (dataDate) return toIsoDate(dataDate);

  throw new Error("KGI redemption trade date was not found");
}

export function parseKgiSummary(rawBody: string): ParsedKgiSummary {
  const holdings = parseKgiHoldings(rawBody, false);
  const stockRatio = holdings.reduce((sum, holding) => sum + (holding.weight ?? 0), 0);
  const roundedStockRatio = holdings.some((holding) => holding.weight !== null) ? Number(stockRatio.toFixed(4)) : null;
  const dataDate = readInputValue(rawBody, "DataDate");

  return {
    tradeDate: detectKgiPcfTradeDate(rawBody),
    announcementDate: dataDate ? toIsoDate(dataDate) : null,
    nav: parseNumber(findSummaryValue(rawBody, /每受益權單位淨資產價值/u) ?? ""),
    totalUnits: parseNumber(findSummaryValue(rawBody, /已發行受益權單位總數/u) ?? ""),
    fundSize: parseNumber(findSummaryValue(rawBody, /基金淨資產價值/u) ?? ""),
    netCreationUnits: parseNumber(findSummaryValue(rawBody, /與前日已發行單位差異數/u) ?? ""),
    stockRatio: roundedStockRatio
  };
}

export function parseKgiHoldings(rawBody: string, validateSummary = true): ParsedKgiHolding[] {
  const fundSize = validateSummary ? parseKgiSummary(rawBody).fundSize : null;
  const tableBody = readStockTableBody(rawBody);
  const rows = tableBody.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  const holdings = rows
    .map((row) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
      if (cells.length !== 4 || cells[0].includes("合計")) return null;

      const shares = parseNumber(cells[2]) ?? 0;
      const weight = parseNumber(cells[3]);

      return {
        stockId: cells[0].trim(),
        stockName: cells[1].trim(),
        shares,
        lots: shares / 1000,
        weight,
        marketValue: fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null
      };
    })
    .filter((row): row is ParsedKgiHolding => row !== null && row.stockId !== "" && row.stockName !== "");

  if (holdings.length === 0) {
    throw new Error("KGI redemption holdings were not found");
  }

  return holdings;
}
