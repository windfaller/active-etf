import { z } from "zod";

const nomuraFundAssetSchema = z.object({
  Aum: z.union([z.string(), z.number(), z.null()]).optional(),
  Units: z.union([z.string(), z.number(), z.null()]).optional(),
  Nav: z.union([z.string(), z.number(), z.null()]).optional(),
  NavDate: z.string()
});

const nomuraTableSchema = z.object({
  TableTitle: z.string(),
  Rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  NavDate: z.string().optional()
});

const nomuraFundAssetsResponseSchema = z.object({
  Entries: z.object({
    FundID: z.string(),
    Data: z.object({
      FundAsset: nomuraFundAssetSchema,
      Table: z.array(nomuraTableSchema)
    })
  }),
  Message: z.string().optional(),
  StatusCode: z.number()
});

export type NomuraFundAssetsResponse = z.infer<typeof nomuraFundAssetsResponseSchema>;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.replace(/TWD\$|,/g, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function slashDateToIso(date: string): string {
  const match = date.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    throw new Error(`Unsupported Nomura date format: ${date}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseNomuraFundAssets(rawBody: string): NomuraFundAssetsResponse["Entries"] {
  const parsed = nomuraFundAssetsResponseSchema.parse(JSON.parse(rawBody));
  if (parsed.StatusCode !== 0) {
    throw new Error(`Nomura API returned StatusCode ${parsed.StatusCode}: ${parsed.Message ?? ""}`.trim());
  }

  return parsed.Entries;
}

export function detectNomuraFundAssetsTradeDate(rawBody: string): string {
  const entries = parseNomuraFundAssets(rawBody);
  return slashDateToIso(entries.Data.FundAsset.NavDate);
}

export interface ParsedNomuraHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedNomuraSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  stockRatio: number | null;
  cashRatio: number | null;
}

export function parseNomuraHoldings(rawBody: string): ParsedNomuraHolding[] {
  const entries = parseNomuraFundAssets(rawBody);
  const fundSize = parseNumber(entries.Data.FundAsset.Aum);
  const stockTable = entries.Data.Table.find((table) => table.TableTitle === "股票");

  if (!stockTable) {
    return [];
  }

  return stockTable.Rows.map((row) => {
    const [stockId, stockName, sharesValue, weightValue] = row;
    const shares = parseNumber(sharesValue) ?? 0;
    const weight = parseNumber(weightValue);

    return {
      stockId: String(stockId ?? "").trim(),
      stockName: String(stockName ?? "").trim(),
      shares,
      lots: shares / 1000,
      weight,
      marketValue: fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null
    };
  }).filter((row) => row.stockId && row.stockName);
}

export function parseNomuraSummary(rawBody: string): ParsedNomuraSummary {
  const entries = parseNomuraFundAssets(rawBody);
  const fundAsset = entries.Data.FundAsset;
  const allocationRows = entries.Data.Table.find((table) => table.TableTitle === "")?.Rows ?? [];
  const fundSize = parseNumber(fundAsset.Aum);
  const stockValue = parseNumber(allocationRows.find((row) => row[0] === "股票")?.[3]);
  const cashValue = parseNumber(allocationRows.find((row) => row[0] === "現金")?.[3]);

  return {
    tradeDate: slashDateToIso(fundAsset.NavDate),
    nav: parseNumber(fundAsset.Nav),
    totalUnits: parseNumber(fundAsset.Units),
    fundSize,
    stockRatio: fundSize && stockValue !== null ? (stockValue / fundSize) * 100 : null,
    cashRatio: fundSize && cashValue !== null ? (cashValue / fundSize) * 100 : null
  };
}
