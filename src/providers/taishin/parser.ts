function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string): number | null {
  const normalized = stripHtml(value)
    .replace(/TWD|USD|JPY|HKD|,|%/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();

  if (!normalized || normalized === "-") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string): string {
  const trimmed = stripHtml(value);
  const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (!match) {
    throw new Error(`Unsupported Taishin date format: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeStockId(value: string): string {
  const trimmed = stripHtml(value);
  const taiwanTicker = trimmed.match(/^(\d{4})\s+TT$/i);
  return taiwanTicker ? taiwanTicker[1] : trimmed;
}

function readInputValue(rawBody: string, id: string): string | null {
  const inputMatch = rawBody.match(new RegExp(`<input[^>]+id=["']${id}["'][^>]*>`, "i"));
  if (!inputMatch) return null;

  const valueMatch = inputMatch[0].match(/\bvalue=["']([^"']*)["']/i);
  return valueMatch ? decodeHtml(valueMatch[1]) : null;
}

function readSummaryValue(rawBody: string, label: string): string | null {
  const rows = rawBody.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const headerMatch = row.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (!headerMatch) continue;

    if (stripHtml(headerMatch[1]) !== label) continue;

    const valueMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    return valueMatch ? valueMatch[1] : null;
  }

  return null;
}

function readStockTableBody(rawBody: string): string {
  const stockHeader = /<th[^>]*>\s*代號\s*<\/th>\s*<th[^>]*>\s*名稱\s*<\/th>\s*<th[^>]*>\s*股數\s*<\/th>\s*<th[^>]*>\s*持股權重\s*<\/th>/i;
  const headerMatch = stockHeader.exec(rawBody);

  if (!headerMatch) {
    throw new Error("Taishin PCF stock table header was not found");
  }

  const afterHeader = rawBody.slice(headerMatch.index + headerMatch[0].length);
  const bodyMatch = afterHeader.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) {
    throw new Error("Taishin PCF stock table body was not found");
  }

  return bodyMatch[1];
}

export interface ParsedTaishinHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedTaishinSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
}

export function detectTaishinPcfTradeDate(rawBody: string): string {
  const date = readInputValue(rawBody, "PUB_DATE") ?? readInputValue(rawBody, "DATA_DATE");
  if (!date) {
    throw new Error("Taishin PCF date input was not found");
  }

  return toIsoDate(date);
}

export function parseTaishinHoldings(rawBody: string): ParsedTaishinHolding[] {
  const fundSize = parseTaishinSummary(rawBody).fundSize;
  const tableBody = readStockTableBody(rawBody);
  const rows = tableBody.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  return rows
    .map((row) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
      if (cells.length !== 4 || cells[0].includes("合計")) return null;

      const shares = parseNumber(cells[2]) ?? 0;
      const weight = parseNumber(cells[3]);

      return {
        stockId: normalizeStockId(cells[0]),
        stockName: cells[1],
        shares,
        lots: shares / 1000,
        weight,
        marketValue: fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null
      };
    })
    .filter((row): row is ParsedTaishinHolding => row !== null && row.stockId !== "" && row.stockName !== "");
}

export function parseTaishinSummary(rawBody: string): ParsedTaishinSummary {
  const tableBody = readStockTableBody(rawBody);
  const stockTotalMatch = tableBody.match(/股票合計[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);

  return {
    tradeDate: detectTaishinPcfTradeDate(rawBody),
    nav: parseNumber(readSummaryValue(rawBody, "每受益權單位淨資產價值(元)") ?? ""),
    totalUnits: parseNumber(readSummaryValue(rawBody, "已發行受益權單位總數") ?? ""),
    fundSize: parseNumber(readSummaryValue(rawBody, "基金淨資產價值(元)") ?? ""),
    netCreationUnits: parseNumber(readSummaryValue(rawBody, "與前日已發行單位差異數") ?? ""),
    stockRatio: stockTotalMatch ? parseNumber(stockTotalMatch[1]) : null
  };
}
