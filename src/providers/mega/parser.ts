function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&beta;/g, "beta")
    .replace(/&alpha;/g, "alpha");
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
  const match = stripHtml(value).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) {
    throw new Error(`Unsupported Mega date format: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function readSummaryAmount(rawBody: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<div class=["']si-title["']>\\s*${escapedLabel}\\s*</div>\\s*<div class=["']si-amount["']>([\\s\\S]*?)</div>`,
    "i"
  );
  return rawBody.match(re)?.[1] ?? null;
}

export interface ParsedMegaHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedMegaSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  stockRatio: number | null;
}

export function detectMegaTradeDate(rawBody: string): string {
  const sourceDate = rawBody.match(/資料來源：\s*兆豐投信\s*[，,]\s*(\d{4}\/\d{1,2}\/\d{1,2})/u)?.[1];
  if (!sourceDate) {
    throw new Error("Mega product source date was not found");
  }

  return toIsoDate(sourceDate);
}

export function parseMegaSummary(rawBody: string): ParsedMegaSummary {
  const stockRatio = rawBody.match(/<div class=["']fund-title["']>\s*股票\s*\(\s*([\d.]+)\s*%\s*\)/i)?.[1];

  return {
    tradeDate: detectMegaTradeDate(rawBody),
    nav: parseNumber(readSummaryAmount(rawBody, "每單位淨值") ?? ""),
    totalUnits: parseNumber(readSummaryAmount(rawBody, "在外流通單位數") ?? ""),
    fundSize: parseNumber(readSummaryAmount(rawBody, "淨資產價值") ?? ""),
    stockRatio: stockRatio ? parseNumber(stockRatio) : null
  };
}

export function parseMegaHoldings(rawBody: string): ParsedMegaHolding[] {
  const summary = parseMegaSummary(rawBody);
  const sectionMatch = rawBody.match(
    /<div id=["']fund_content_list_1["'][\s\S]*?>([\s\S]*?)<!--\s*mobile\s*-->/i
  );
  if (!sectionMatch) {
    throw new Error("Mega stock holdings section was not found");
  }

  const cells = [...sectionMatch[1].matchAll(/<div class=["']fund-content[^"']*["']>([\s\S]*?)<\/div>/gi)].map(
    (match) => stripHtml(match[1])
  );

  const holdings: ParsedMegaHolding[] = [];
  for (let index = 0; index + 3 < cells.length; index += 4) {
    const [stockId, stockName, sharesText, weightText] = cells.slice(index, index + 4);
    if (!/^\d{4}[A-Z]?$/.test(stockId)) continue;

    const shares = parseNumber(sharesText) ?? 0;
    const weight = parseNumber(weightText);
    holdings.push({
      stockId,
      stockName: stockName.trim(),
      shares,
      lots: shares / 1000,
      weight,
      marketValue: summary.fundSize !== null && weight !== null ? (summary.fundSize * weight) / 100 : null
    });
  }

  if (holdings.length === 0) {
    throw new Error("Mega stock holdings were not found");
  }

  return holdings;
}
