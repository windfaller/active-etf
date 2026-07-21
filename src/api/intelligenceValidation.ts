import { z } from "zod";

export const marketSchema = z.enum(["tw", "us"]);
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "date must use YYYY-MM-DD");
export const windowSchema = z.enum(["3", "5", "20"]).transform((value) => Number(value) as 3 | 5 | 20);
export const styleWindowSchema = z.enum(["20", "60"]).transform((value) => Number(value) as 20 | 60);
export const limitSchema = z.coerce.number().int().min(1).max(50);
export const querySchema = z.string().trim().min(2).max(40).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), "query contains unsupported characters");
export const stockSymbolSchema = z.string().trim().min(1).max(12);
export const comparisonTypeSchema = z.enum(["tw", "global"]);
export const signalKindSchema = z.enum(["all", "consecutive", "reversals", "divergence"]);
export const searchResultTypeSchema = z.enum(["tw_etf", "global_etf", "institution", "tw_stock", "us_stock", "sector", "signal"]);

export function normalizedStockSymbol(market: "tw" | "us", raw: string): string | null {
  const symbol = market === "us" ? raw.toUpperCase() : raw;
  if (market === "tw" && !/^\d{4,6}$/u.test(symbol)) return null;
  if (market === "us" && !/^[A-Z][A-Z0-9.-]{0,9}$/u.test(symbol)) return null;
  return symbol;
}

export function optionalDate(value: string | null): { value?: string; error?: string } {
  if (!value) return {};
  const parsed = isoDateSchema.safeParse(value);
  return parsed.success ? { value: parsed.data } : { error: parsed.error.issues[0]?.message ?? "invalid date" };
}
