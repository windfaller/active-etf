import type { Db } from "mongodb";
import { z } from "zod";
import { configuredEtfs } from "../config/etfs.js";
import { compareEtfs } from "../services/intelligence/etfComparisonService.js";
import { stockEtfs } from "../services/intelligence/stockIntelligenceService.js";
import { quotaDay, AgentError } from "./core.js";

const codes = configuredEtfs.filter((x) => x.enabled).map((x) => x.etfCode);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .refine((x) => codes.includes(x), "Unsupported Taiwan-listed ETF");
const group = z
  .array(code)
  .min(1)
  .max(3)
  .transform((x) => [...new Set(x)].sort());
export const toolDefinitions = {
  search_market_entities: {
    cost: 0,
    description:
      "Search supported Taiwan-listed ETFs by code or name. 0 research points.",
    schema: z.object({ query: z.string().trim().max(40).default("") }).strict(),
  },
  get_my_plan_usage: {
    cost: 0,
    description:
      "Read your remaining daily research points and reset time. 0 points.",
    schema: z.object({}).strict(),
  },
  get_etf_snapshot: {
    cost: 1,
    description:
      "Latest available complete holdings and fund summary for one Taiwan-listed ETF. Includes source date. 1 point.",
    schema: z.object({ code }).strict(),
  },
  get_etf_changes: {
    cost: 1,
    description:
      "Holding changes for one Taiwan-listed ETF within the last 1–30 calendar days. Raw changes are not necessarily manager trades. 1 point.",
    schema: z
      .object({ code, days: z.number().int().min(1).max(30).default(7) })
      .strict(),
  },
  compare_etfs: {
    cost: 2,
    description:
      "Compare 2–3 Taiwan-listed ETFs: holdings overlap, exposure and available metrics. 2 points.",
    schema: z
      .object({
        codes: group.refine((x) => x.length >= 2, "At least two distinct ETFs"),
      })
      .strict(),
  },
  get_stock_context: {
    cost: 2,
    description:
      "Find Taiwan-listed ETFs holding a Taiwan stock and their observed changes. 2 points.",
    schema: z.object({ symbol: z.string().regex(/^\d{4,6}$/) }).strict(),
  },
  build_research_brief: {
    cost: 3,
    description:
      "Build a factual research brief for up to three Taiwan-listed ETFs, with latest holdings and changes. 3 points total; no additional charges for internal queries.",
    schema: z.object({ codes: group }).strict(),
  },
} as const;
export type ToolName = keyof typeof toolDefinitions;
export type ResearchData = { data: Record<string, unknown>; hasData: boolean };
export type ResearchProvider = (
  name: ToolName,
  args: Record<string, unknown>,
) => Promise<ResearchData>;

function publicRows(rows: Record<string, unknown>[]) {
  return rows.map(
    ({ _id, rawSnapshotId, createdAt, updatedAt, ...row }) => row,
  );
}
export function createResearchProvider(
  getDb: () => Promise<Db>,
): ResearchProvider {
  async function snapshot(etfCode: string) {
    const db = await getDb();
    const latest = await db.collection("etf_daily_holdings").findOne(
      { etfCode },
      {
        sort: { tradeDate: -1 },
        projection: { tradeDate: 1 },
        maxTimeMS: 10_000,
      },
    );
    const sourceAsOf = latest?.tradeDate as string | undefined;
    const config = configuredEtfs.find((x) => x.etfCode === etfCode)!;
    if (!sourceAsOf)
      return {
        code: etfCode,
        sourceAsOf: null,
        holdings: [],
        summary: null,
        source: config.source.infoUrl,
      };
    const [rows, summary] = await Promise.all([
      db
        .collection("etf_daily_holdings")
        .find({ etfCode, tradeDate: sourceAsOf })
        .sort({ weight: -1 })
        .maxTimeMS(15_000)
        .toArray(),
      db
        .collection("etf_daily_summaries")
        .findOne({ etfCode, tradeDate: sourceAsOf }, { maxTimeMS: 10_000 }),
    ]);
    return {
      code: etfCode,
      name: config.name,
      sourceAsOf,
      holdings: publicRows(rows),
      summary: summary ? publicRows([summary])[0] : null,
      source: config.source.infoUrl,
    };
  }
  async function changes(etfCode: string, days: number) {
    const db = await getDb(),
      end = quotaDay(),
      start = quotaDay(Date.now() - (days - 1) * 86400_000);
    const rows = await db
      .collection("etf_holding_changes")
      .find({ etfCode, tradeDate: { $gte: start, $lte: end } })
      .sort({ tradeDate: -1, stockId: 1 })
      .limit(10_001)
      .maxTimeMS(15_000)
      .toArray();
    if (rows.length > 10_000)
      throw new AgentError("result_too_large_use_shorter_period");
    return {
      code: etfCode,
      period: { start, end },
      sourceAsOf: rows[0]?.tradeDate ?? null,
      observedDates: [...new Set(rows.map((x) => x.tradeDate))],
      changes: publicRows(rows),
      source: configuredEtfs.find((x) => x.etfCode === etfCode)!.source.infoUrl,
    };
  }
  return async (name, args) => {
    if (name === "search_market_entities") {
      const q = String(args.query).toLowerCase();
      const rows = configuredEtfs
        .filter(
          (x) =>
            x.enabled &&
            `${x.etfCode} ${x.name} ${x.issuer}`.toLowerCase().includes(q),
        )
        .slice(0, 20)
        .map((x) => ({
          code: x.etfCode,
          name: x.name,
          issuer: x.issuer,
          source: x.source.infoUrl,
        }));
      return {
        data: { market: "Taiwan-listed ETFs", results: rows },
        hasData: rows.length > 0,
      };
    }
    if (name === "get_etf_snapshot") {
      const data = await snapshot(String(args.code));
      return { data, hasData: data.holdings.length > 0 };
    }
    if (name === "get_etf_changes") {
      const data = await changes(String(args.code), Number(args.days));
      return { data, hasData: data.changes.length > 0 };
    }
    if (name === "compare_etfs") {
      const data = await compareEtfs(
        await getDb(),
        "tw",
        args.codes as string[],
      );
      return {
        data: data as unknown as Record<string, unknown>,
        hasData: data.cards.some((x) => x.sourceAsOf !== null),
      };
    }
    if (name === "get_stock_context") {
      const data = await stockEtfs(await getDb(), "tw", String(args.symbol));
      return {
        data: data as unknown as Record<string, unknown>,
        hasData: Array.isArray(data.rows) && data.rows.length > 0,
      };
    }
    if (name === "build_research_brief") {
      const funds = await Promise.all(
        (args.codes as string[]).map(async (c) => ({
          snapshot: await snapshot(c),
          recentChanges: await changes(c, 7),
        })),
      );
      return {
        data: {
          funds,
          methodology:
            "Observed holdings and scale-adjusted changes where available; dates can differ. Missing observations are unknown, not zero.",
          disclaimer: "Research data, not personalized investment advice.",
        },
        hasData: funds.some((x) => x.snapshot.holdings.length > 0),
      };
    }
    throw new AgentError("unknown_tool");
  };
}
