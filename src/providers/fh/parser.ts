import { z } from "zod";
import { round } from "../../utils/number.js";

const fhAssetDetailSchema = z.object({
  ftype: z.string().nullable(),
  stockid: z.string().nullable(),
  stockname: z.string().nullable(),
  qshare: z.string().nullable(),
  mvalue: z.string().nullable(),
  prate_addaccint: z.string().nullable()
});

const fhAssetSummaryItemSchema = z.object({
  ftype: z.string().nullable(),
  itemName: z.string().nullable(),
  tot_mvalue: z.string().nullable()
});

const fhAssetsRowSchema = z.object({
  fundID: z.string().nullable(),
  etf002: z.string().nullable(),
  dDate: z.string().nullable(),
  pcf_FundNav: z.string().nullable(),
  pcf_FundQissue: z.string().nullable(),
  pcf_Fundpnav: z.string().nullable(),
  result: z.array(fhAssetSummaryItemSchema).nullable(),
  detail: z.array(fhAssetDetailSchema).nullable()
});

const fhAssetsResponseSchema = z.object({
  result: z.array(fhAssetsRowSchema)
});

const fhPcfRowSchema = z.object({
  postDate: z.string().nullable(),
  nav: z.string().nullable(),
  qIssue: z.string().nullable(),
  qDiff: z.string().nullable(),
  pnav: z.string().nullable()
});

const fhPcfResponseSchema = z.object({
  result: z.array(fhPcfRowSchema).nullable()
});

const fhCombinedPayloadSchema = z.object({
  assets: fhAssetsResponseSchema,
  pcf: fhPcfResponseSchema.nullable()
});

type FhAssetsRow = z.infer<typeof fhAssetsRowSchema>;
type FhPcfRow = z.infer<typeof fhPcfRowSchema>;

export interface ParsedFhHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedFhSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  cashRatio: number | null;
  stockRatio: number | null;
}

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;

  const trimmed = value.trim();
  const isParenthesized = /^\(.+\)$/u.test(trimmed);
  const normalized = trimmed.replace(/NTD|TWD|NT\$|\$|,|%|\(|\)|\s/giu, "");
  if (!normalized || normalized === "-") return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return isParenthesized ? -parsed : parsed;
}

function toIsoDate(value: string | null | undefined): string {
  const match = value?.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/u);
  if (!match) {
    throw new Error(`Unsupported Fuh Hwa date format: ${value ?? ""}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseCombined(rawBody: string): { assets: FhAssetsRow; pcf: FhPcfRow | null } {
  const parsed = fhCombinedPayloadSchema.parse(JSON.parse(rawBody));
  const assets = parsed.assets.result[0];
  if (!assets?.dDate || !assets.detail?.length) {
    throw new Error("Fuh Hwa assets response did not include a dated holdings list");
  }

  return {
    assets,
    pcf: parsed.pcf?.result?.[0] ?? null
  };
}

function assetValue(row: FhAssetsRow, labelPattern: RegExp): number | null {
  const item = row.result?.find((entry) => labelPattern.test(entry.itemName ?? ""));
  return parseNumber(item?.tot_mvalue);
}

export function detectFhTradeDate(rawBody: string): string {
  return toIsoDate(parseCombined(rawBody).assets.dDate);
}

export function parseFhHoldings(rawBody: string): ParsedFhHolding[] {
  const { assets } = parseCombined(rawBody);

  return (assets.detail ?? [])
    .filter((row) => row.ftype === "股票" && /^\d{4}$/u.test(row.stockid?.trim() ?? ""))
    .map((row) => {
      const shares = parseNumber(row.qshare) ?? 0;

      return {
        stockId: row.stockid?.trim() ?? "",
        stockName: row.stockname?.replace(/\s+/gu, " ").trim() ?? "",
        shares,
        lots: shares / 1000,
        weight: parseNumber(row.prate_addaccint),
        marketValue: parseNumber(row.mvalue)
      };
    })
    .filter((holding) => holding.stockName);
}

export function parseFhSummary(rawBody: string): ParsedFhSummary {
  const { assets, pcf } = parseCombined(rawBody);
  const fundSize = parseNumber(assets.pcf_FundNav);
  const stockValue = assetValue(assets, /^股票$/u);
  const otherAssetValue =
    assetValue(assets, /扣除應付買入證券款後現金餘額/u) ?? assetValue(assets, /現金/u);

  return {
    tradeDate: toIsoDate(assets.dDate),
    nav: parseNumber(assets.pcf_Fundpnav),
    totalUnits: parseNumber(assets.pcf_FundQissue),
    fundSize,
    netCreationUnits: parseNumber(pcf?.qDiff),
    cashRatio: fundSize !== null && otherAssetValue !== null ? round((otherAssetValue / fundSize) * 100) : null,
    stockRatio: fundSize !== null && stockValue !== null ? round((stockValue / fundSize) * 100) : null
  };
}
