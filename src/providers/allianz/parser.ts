import { z } from "zod";
import { sourceDateToIsoDate } from "../../utils/date.js";

const numberishSchema = z.union([z.number(), z.string(), z.null()]);

const allianzDynamicTableSchema = z.object({
  TableTitle: z.string(),
  Columns: z.array(z.object({ Name: z.string(), TextAlign: z.string().optional() })).default([]),
  Rows: z.array(z.array(z.string())).default([])
});

const allianzTradeInfoSchema = z.object({
  TotalPages: z.number().optional(),
  TotalItems: z.number().optional(),
  Entries: z
    .object({
      CFundId: z.string(),
      CFullName: z.string().nullable().optional(),
      CFundShortName: z.string().nullable().optional(),
      CPcfdate: z.string(),
      CNavDt: z.string(),
      CAnceTotalAv: numberishSchema,
      CAnceTotalIssues: numberishSchema,
      CAnceIssuesDiff: numberishSchema,
      CAnceNav: numberishSchema,
      CEtfindexCurrency: z.string().nullable().optional(),
      DynamicTableData: z.array(allianzDynamicTableSchema).default([]),
      CSecuritiesCode: z.string().nullable().optional()
    })
    .nullable(),
  Message: z.string().nullable().optional(),
  StatusCode: z.number()
});

export type AllianzTradeInfoResponse = z.infer<typeof allianzTradeInfoSchema>;
export type AllianzTradeInfoEntries = NonNullable<AllianzTradeInfoResponse["Entries"]>;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/TWD|USD|JPY|HKD|,|%/g, "")
    .replace(/^\((.*)\)$/u, "-$1")
    .trim();
  if (!normalized || normalized === "-") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function findStockTable(entries: AllianzTradeInfoEntries): z.infer<typeof allianzDynamicTableSchema> {
  const table = entries.DynamicTableData.find((item) => item.TableTitle.includes("股票"));
  if (!table) {
    throw new Error("Allianz stock table was not found");
  }

  const headers = table.Columns.map((column) => column.Name);
  for (const required of ["股票代號", "股票名稱", "股數", "權重(%)"]) {
    if (!headers.includes(required)) {
      throw new Error(`Allianz stock table missing header: ${required}`);
    }
  }

  return table;
}

function parseStockRatio(title: string): number | null {
  const match = title.match(/股票\s*\(([-\d,.]+)%\)/u);
  return match ? parseNumber(match[1]) : null;
}

export function parseAllianzTradeInfo(rawBody: string): AllianzTradeInfoEntries {
  const parsed = allianzTradeInfoSchema.parse(JSON.parse(rawBody));
  if (parsed.StatusCode !== 0) {
    throw new Error(`Allianz API returned StatusCode ${parsed.StatusCode}: ${parsed.Message ?? ""}`.trim());
  }
  if (!parsed.Entries?.CFundId) {
    throw new Error("Allianz API did not return trade info entries");
  }

  return parsed.Entries;
}

export function detectAllianzTradeDate(rawBody: string): string {
  return sourceDateToIsoDate(parseAllianzTradeInfo(rawBody).CNavDt);
}

export interface ParsedAllianzHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedAllianzSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
}

export function parseAllianzHoldings(rawBody: string): ParsedAllianzHolding[] {
  const entries = parseAllianzTradeInfo(rawBody);
  const fundSize = parseNumber(entries.CAnceTotalAv);
  const table = findStockTable(entries);
  const headers = table.Columns.map((column) => column.Name);
  const stockIdIndex = headers.indexOf("股票代號");
  const stockNameIndex = headers.indexOf("股票名稱");
  const sharesIndex = headers.indexOf("股數");
  const weightIndex = headers.indexOf("權重(%)");

  return table.Rows.map((row) => {
    const shares = parseNumber(row[sharesIndex]) ?? 0;
    const weight = parseNumber(row[weightIndex]);

    return {
      stockId: (row[stockIdIndex] ?? "").trim(),
      stockName: (row[stockNameIndex] ?? "").trim(),
      shares,
      lots: shares / 1000,
      weight,
      marketValue: fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null
    };
  }).filter((row) => row.stockId && row.stockName);
}

export function parseAllianzSummary(rawBody: string): ParsedAllianzSummary {
  const entries = parseAllianzTradeInfo(rawBody);
  const stockTable = findStockTable(entries);

  return {
    tradeDate: sourceDateToIsoDate(entries.CNavDt),
    nav: parseNumber(entries.CAnceNav),
    totalUnits: parseNumber(entries.CAnceTotalIssues),
    fundSize: parseNumber(entries.CAnceTotalAv),
    netCreationUnits: parseNumber(entries.CAnceIssuesDiff),
    stockRatio: parseStockRatio(stockTable.TableTitle)
  };
}
