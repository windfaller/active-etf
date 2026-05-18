import { z } from "zod";

const webApiEnvelopeSchema = z.object({
  d: z.string().nullable()
});

const firstCombinedPcfSchema = z.object({
  summary: webApiEnvelopeSchema,
  holdings: webApiEnvelopeSchema
});

const firstSummaryRowSchema = z.object({
  fundid: z.string(),
  sdate: z.string(),
  A: z.string(),
  B: z.string()
});

const firstHoldingRowSchema = z.object({
  fundid: z.string(),
  sdate: z.string(),
  group: z.string(),
  A: z.string(),
  B: z.string(),
  C: z.string(),
  D: z.string(),
  E: z.string().optional()
});

type FirstSummaryRow = z.infer<typeof firstSummaryRowSchema>;
type FirstHoldingRow = z.infer<typeof firstHoldingRowSchema>;

export interface ParsedFirstHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedFirstSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
}

function toIsoDate(date: string): string {
  const match = date.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) {
    throw new Error(`Unsupported First date format: ${date}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/TWD|,|%/g, "").trim();
  if (!normalized || normalized === "-") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEnvelopeRows<T>(payload: unknown, schema: z.ZodType<T>): T[] {
  const envelope = webApiEnvelopeSchema.parse(payload);
  if (!envelope.d) return [];

  const rows = JSON.parse(envelope.d) as unknown[];
  return z.array(schema).parse(rows);
}

function parseCombinedPcf(rawBody: string): {
  summaryRows: FirstSummaryRow[];
  holdingRows: FirstHoldingRow[];
} {
  const parsed = firstCombinedPcfSchema.parse(JSON.parse(rawBody));

  return {
    summaryRows: parseEnvelopeRows(parsed.summary, firstSummaryRowSchema),
    holdingRows: parseEnvelopeRows(parsed.holdings, firstHoldingRowSchema)
  };
}

function summaryValue(rows: FirstSummaryRow[], labelPattern: RegExp): string | undefined {
  return rows.find((row) => labelPattern.test(row.A))?.B;
}

export function detectFirstPcfTradeDate(rawBody: string): string {
  const { summaryRows, holdingRows } = parseCombinedPcf(rawBody);
  const holdingDate = holdingRows.find((row) => row.group === "1" && row.sdate)?.sdate;
  const summaryDate = summaryRows.find((row) => row.sdate)?.sdate;
  const tradeDate = holdingDate ?? summaryDate;

  if (!tradeDate) {
    throw new Error("First PCF response did not include a trade date");
  }

  return toIsoDate(tradeDate);
}

export function parseFirstHoldings(rawBody: string): ParsedFirstHolding[] {
  const { summaryRows, holdingRows } = parseCombinedPcf(rawBody);
  const fundSize = parseNumber(summaryValue(summaryRows, /基金淨資產價值/));

  return holdingRows
    .filter((row) => row.group === "1" && /^\d{4}$/.test(row.A.trim()))
    .map((row) => {
      const shares = parseNumber(row.D) ?? 0;
      const weight = parseNumber(row.C);

      return {
        stockId: row.A.trim(),
        stockName: row.B.trim(),
        shares,
        lots: shares / 1000,
        weight,
        marketValue: fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null
      };
    })
    .filter((holding) => holding.stockName);
}

export function parseFirstSummary(rawBody: string): ParsedFirstSummary {
  const { summaryRows, holdingRows } = parseCombinedPcf(rawBody);
  const stockRatio = holdingRows
    .filter((row) => row.group === "1")
    .reduce((sum, row) => sum + (parseNumber(row.C) ?? 0), 0);

  return {
    tradeDate: detectFirstPcfTradeDate(rawBody),
    nav: parseNumber(summaryValue(summaryRows, /每受益權單位淨資產價值/)),
    totalUnits: parseNumber(summaryValue(summaryRows, /已發行受益權單位總數/)),
    fundSize: parseNumber(summaryValue(summaryRows, /基金淨資產價值/)),
    netCreationUnits: parseNumber(summaryValue(summaryRows, /與前日已發行單位差異數/)),
    stockRatio: stockRatio || null
  };
}
