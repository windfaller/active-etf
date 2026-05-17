import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import { sourceDateToIsoDate } from "../../utils/date.js";
import { round } from "../../utils/number.js";

export interface ParsePcfInput {
  etfCode: string;
  tradeDate: string;
  rawSnapshotId: string;
  rawBody: string;
  contentType: string;
}

export function detectEzmoneyPcfTradeDate(rawBody: string): string {
  const parsed = JSON.parse(rawBody) as {
    pcf?: Array<{
      PCFCode?: string;
      ValueDate?: string;
      TranDate?: string;
    }>;
  };
  const navRow = (parsed.pcf ?? []).find((row) => row.PCFCode === "P_UNIT");
  if (!navRow) {
    throw new Error("Ezmoney PCF response is missing P_UNIT nav row");
  }

  return navRow.ValueDate?.trim()
    ? sourceDateToIsoDate(navRow.ValueDate)
    : sourceDateToIsoDate(navRow.TranDate ?? "");
}

export function parseEzmoneyPcf(_input: ParsePcfInput): EtfDailySummary {
  const input = _input;
  const parsed = JSON.parse(input.rawBody) as {
    pcf?: Array<{
      PCFCode?: string;
      Amount?: number;
      ValueDate?: string;
      TranDate?: string;
    }>;
    asset?: Array<{
      AssetCode?: string;
      Value?: number;
    }>;
  };
  const pcf = parsed.pcf ?? [];
  const byCode = new Map(pcf.map((row) => [row.PCFCode, row]));
  const navRow = byCode.get("P_UNIT");
  const fundSizeRow = byCode.get("NAV");
  const totalUnitsRow = byCode.get("OUT_UNIT");
  const diffUnitsRow = byCode.get("DIFF_UNIT");

  if (!navRow || typeof navRow.Amount !== "number") {
    throw new Error("Ezmoney PCF response is missing P_UNIT nav row");
  }

  const tradeDate = detectEzmoneyPcfTradeDate(input.rawBody);
  if (tradeDate !== input.tradeDate) {
    throw new Error(`PCF tradeDate mismatch: expected ${input.tradeDate}, got ${tradeDate}`);
  }

  const fundSize = typeof fundSizeRow?.Amount === "number" ? fundSizeRow.Amount : null;
  const stockAssetValue = parsed.asset?.find((asset) => asset.AssetCode === "ST")?.Value ?? null;
  const stockRatio = fundSize && stockAssetValue ? round((stockAssetValue / fundSize) * 100) : null;
  const now = new Date();

  return {
    etfCode: input.etfCode,
    tradeDate,
    nav: navRow.Amount,
    marketPrice: null,
    premiumDiscount: null,
    totalUnits: typeof totalUnitsRow?.Amount === "number" ? totalUnitsRow.Amount : null,
    fundSize,
    netCreationUnits: typeof diffUnitsRow?.Amount === "number" ? diffUnitsRow.Amount : null,
    cashRatio: stockRatio === null ? null : round(100 - stockRatio),
    stockRatio,
    source: "ezmoney",
    rawSnapshotId: input.rawSnapshotId,
    createdAt: now,
    updatedAt: now
  };
}
