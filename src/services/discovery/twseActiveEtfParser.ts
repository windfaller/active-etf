import { z } from "zod";

const twseProductRowSchema = z.object({
  stockNo: z.string(),
  stockName: z.string(),
  listingDate: z.string(),
  indexName: z.string().nullable().optional(),
  totalAv: z.string().nullable().optional(),
  close1: z.string().nullable().optional(),
  holders: z.string().nullable().optional(),
  valueYTD: z.string().nullable().optional(),
  volumeYTD: z.string().nullable().optional(),
  issuer: z.string()
});

const twseProductsResponseSchema = z.object({
  status: z.string(),
  data: z.array(twseProductRowSchema)
});

export interface TwseActiveEtfProduct {
  etfCode: string;
  stockName: string;
  listingDate: string;
  issuer: string;
  indexName: string | null;
  totalAssetValue: number | null;
  closePrice: number | null;
  holders: number | null;
  valueYtd: number | null;
  volumeYtd: number | null;
}

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/gu, "").trim();
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string): string {
  const match = value.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/u);
  if (!match) {
    throw new Error(`Unsupported TWSE ETF listing date: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseTwseActiveEtfProducts(rawBody: string): TwseActiveEtfProduct[] {
  const parsed = twseProductsResponseSchema.parse(JSON.parse(rawBody));
  if (parsed.status !== "success") {
    throw new Error(`TWSE ETFortune active ETF response status is ${parsed.status}`);
  }

  return parsed.data.map((row) => ({
    etfCode: row.stockNo.trim(),
    stockName: row.stockName.trim(),
    listingDate: toIsoDate(row.listingDate),
    issuer: row.issuer.trim(),
    indexName: row.indexName?.trim() || null,
    totalAssetValue: parseNumber(row.totalAv),
    closePrice: parseNumber(row.close1),
    holders: parseNumber(row.holders),
    valueYtd: parseNumber(row.valueYTD),
    volumeYtd: parseNumber(row.volumeYTD)
  }));
}
