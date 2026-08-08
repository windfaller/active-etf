export interface ParsedSinopacHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedSinopacSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = decodeHtml(value).replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string): string {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) throw new Error(`Unsupported SinoPac date format: ${value}`);
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function tableByClass(rawBody: string, className: string): string {
  const table = rawBody.match(
    new RegExp(`<table[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/table>`, "i")
  )?.[1];
  if (!table) throw new Error(`SinoPac PCF table was not found: ${className}`);
  return table;
}

function tableRows(table: string): string[][] {
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1]))
  );
}

function summaryTableValue(rawBody: string, label: string): number | null {
  const row = tableRows(tableByClass(rawBody, "tab_fu-09")).find((cells) => cells[0]?.includes(label));
  return parseNumber(row?.[1]);
}

function headingValue(rawBody: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = rawBody.match(
    new RegExp(`<h4[^>]*>\\s*${escaped}\\s*<\\/h4>[\\s\\S]*?<p[^>]*>([\\s\\S]*?)<\\/p>`, "i")
  )?.[1];
  return parseNumber(value);
}

export function detectSinopacPcfTradeDate(rawBody: string): string {
  const date = rawBody.match(/資料日期\s*[：:]\s*(\d{4}\/\d{1,2}\/\d{1,2})/u)?.[1];
  if (!date) throw new Error("SinoPac PCF response did not include a trade date");
  return toIsoDate(date);
}

export function parseSinopacHoldings(rawBody: string): ParsedSinopacHolding[] {
  const fundSize = summaryTableValue(rawBody, "基金淨資產價值");
  const holdings = tableRows(tableByClass(rawBody, "tab_fu-07"))
    .filter((cells) => /^\d{4,6}$/.test(cells[0] ?? "") && cells.length >= 4)
    .map((cells) => {
      const shares = parseNumber(cells[2]) ?? 0;
      const weight = parseNumber(cells[3]);
      return {
        stockId: cells[0],
        stockName: cells[1],
        shares,
        lots: shares / 1000,
        weight,
        marketValue: fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null
      };
    });

  if (!holdings.length) throw new Error("SinoPac PCF response did not include stock holdings");
  return holdings;
}

export function parseSinopacSummary(rawBody: string): ParsedSinopacSummary {
  const holdings = parseSinopacHoldings(rawBody);
  const stockRatio = holdings.reduce((sum, holding) => sum + (holding.weight ?? 0), 0);

  return {
    tradeDate: detectSinopacPcfTradeDate(rawBody),
    nav: summaryTableValue(rawBody, "基金每單位淨值"),
    totalUnits: summaryTableValue(rawBody, "基金在外流通單位數"),
    fundSize: summaryTableValue(rawBody, "基金淨資產價值"),
    netCreationUnits: headingValue(rawBody, "與前日已發行單位差異數"),
    stockRatio: stockRatio || null
  };
}
