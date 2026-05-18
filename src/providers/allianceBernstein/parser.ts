function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string): string {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const [, month, day, year] = slash;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  throw new Error(`Unsupported AllianceBernstein date format: ${value}`);
}

interface AllianceBernsteinHoldingRow {
  holding: string;
  holdingPerc: string | number | null;
  holdingCode: string;
  holdingShares: number | null;
  holdingValue: number | null;
}

interface AllianceBernsteinHoldingCategory {
  asOfDate: string;
  holdingCategory: string;
  holdings: AllianceBernsteinHoldingRow[];
}

interface AllianceBernsteinBasket {
  asOfDate: string;
  nav: number;
  aum: number;
  shares: number;
  sharesChange: number | null;
  announcementDate: string | null;
}

interface AllianceBernsteinCombinedRaw {
  holdings: {
    domesticHoldings?: AllianceBernsteinHoldingCategory[];
  };
  basket: AllianceBernsteinBasket;
}

export interface ParsedAllianceBernsteinHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedAllianceBernsteinSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
}

function parseRaw(rawBody: string): AllianceBernsteinCombinedRaw {
  const parsed = JSON.parse(rawBody) as AllianceBernsteinCombinedRaw;
  if (!parsed.basket || !parsed.holdings) {
    throw new Error("AllianceBernstein combined raw response is missing basket or holdings");
  }

  return parsed;
}

export function detectAllianceBernsteinTradeDate(rawBody: string): string {
  return toIsoDate(parseRaw(rawBody).basket.asOfDate);
}

export function parseAllianceBernsteinSummary(rawBody: string): ParsedAllianceBernsteinSummary {
  const { basket } = parseRaw(rawBody);

  return {
    tradeDate: toIsoDate(basket.asOfDate),
    nav: parseNumber(basket.nav),
    totalUnits: parseNumber(basket.shares),
    fundSize: parseNumber(basket.aum),
    netCreationUnits: parseNumber(basket.sharesChange)
  };
}

export function parseAllianceBernsteinHoldings(rawBody: string): ParsedAllianceBernsteinHolding[] {
  const raw = parseRaw(rawBody);
  const categories = raw.holdings.domesticHoldings ?? [];
  const holdings: ParsedAllianceBernsteinHolding[] = [];

  for (const category of categories) {
    for (const [index, row] of category.holdings.entries()) {
      const shares = parseNumber(row.holdingShares) ?? 0;
      const code = row.holdingCode?.trim();
      holdings.push({
        stockId: code || `${category.holdingCategory.replace(/^holdings-section-/, "")}-${index + 1}`,
        stockName: row.holding.trim(),
        shares,
        lots: shares / 1000,
        weight: parseNumber(row.holdingPerc),
        marketValue: parseNumber(row.holdingValue)
      });
    }
  }

  if (holdings.length === 0) {
    throw new Error("AllianceBernstein holdings were not found");
  }

  return holdings;
}
