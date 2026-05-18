function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|\u00a0/g, " ")
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
  const match = stripHtml(value).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) {
    throw new Error(`Unsupported Fubon date format: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function readSummaryAmount(rawBody: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<p>\\s*${escapedLabel}\\s*</p>\\s*<p>([\\s\\S]*?)</p>`, "i");
  return rawBody.match(re)?.[1] ?? null;
}

export interface ParsedFubonHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedFubonSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
}

export function detectFubonTradeDate(rawBody: string): string {
  const sourceDate = rawBody.match(/資料日期：\s*(\d{4}\/\d{1,2}\/\d{1,2})/u)?.[1];
  if (!sourceDate) {
    throw new Error("Fubon assets source date was not found");
  }

  return toIsoDate(sourceDate);
}

export function parseFubonSummary(rawBody: string): ParsedFubonSummary {
  return {
    tradeDate: detectFubonTradeDate(rawBody),
    nav: parseNumber(readSummaryAmount(rawBody, "基金每單位淨值(新台幣)") ?? ""),
    totalUnits: parseNumber(readSummaryAmount(rawBody, "基金在外流通單位數(單位)") ?? ""),
    fundSize: parseNumber(readSummaryAmount(rawBody, "基金淨資產(新台幣)") ?? "")
  };
}

function parseAssetTables(rawBody: string): ParsedFubonHolding[] {
  const tables = rawBody.match(/<table class=["']table1 fix3[\s\S]*?<\/table>/gi) ?? [];
  const holdings: ParsedFubonHolding[] = [];

  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    for (const row of rows.slice(1)) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
      if (cells.length < 5) continue;
      if (/合計/u.test(cells[0])) continue;

      const shares = parseNumber(cells[2]) ?? 0;
      const marketValue = parseNumber(cells[3]);
      holdings.push({
        stockId: cells[0],
        stockName: cells[1],
        shares,
        lots: shares / 1000,
        weight: parseNumber(cells[4]),
        marketValue
      });
    }
  }

  return holdings;
}

export function parseFubonHoldings(rawBody: string): ParsedFubonHolding[] {
  parseFubonSummary(rawBody);
  const holdings = parseAssetTables(rawBody).filter((row) => row.stockId !== "" && row.stockName !== "");

  if (holdings.length === 0) {
    throw new Error("Fubon asset holdings were not found");
  }

  return holdings;
}
