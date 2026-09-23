import type { Db, Filter } from "mongodb";
import { z } from "zod";
import { configuredEtfs } from "../config/etfs.js";
import { enabledGlobalEtfs } from "../config/globalEtfs.js";
import type { GlobalEtfHoldingChange, GlobalEtfSnapshot } from "../models/GlobalEtf.js";
import { compareEtfs } from "../services/intelligence/etfComparisonService.js";
import { stockEtfs } from "../services/intelligence/stockIntelligenceService.js";
import { quotaDay, AgentError } from "./core.js";

const taiwanEtfs = configuredEtfs.filter((x) => x.enabled);
const globalEtfs = enabledGlobalEtfs.filter((x) => x.enabled && x.strategyType !== "13f");
const globalByCode = new Map(globalEtfs.map((x) => [x.etfCode, x]));
const codes = [...taiwanEtfs.map((x) => x.etfCode), ...globalEtfs.map((x) => x.etfCode)];
const isGlobal = (etfCode: string) => globalByCode.has(etfCode);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .refine((x) => codes.includes(x), "Unsupported ETF or 13F portfolio");
const group = z
  .array(code)
  .min(1)
  .max(3)
  .transform((x) => [...new Set(x)].sort());
export const toolDefinitions = {
  search_market_entities: {
    cost: 0,
    description:
      "Search supported Taiwan-listed and US-listed ETFs by code or name. Excludes 13F portfolios. 0 research points.",
    schema: z.object({ query: z.string().trim().max(40).default(""), market: z.enum(["all", "tw", "us"]).default("all") }).strict(),
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
      "Latest available complete holdings for one supported Taiwan-listed or US-listed ETF, with issuer source and data date. 1 point.",
    schema: z.object({ code }).strict(),
  },
  get_etf_changes: {
    cost: 1,
    description:
      "Observed holding changes for one supported Taiwan-listed or US-listed ETF within 1–30 calendar days. For US-listed funds, results are limited and mark truncation; weight changes are not necessarily trades. 1 point.",
    schema: z
      .object({ code, days: z.number().int().min(1).max(30).default(7), limit: z.number().int().min(1).max(500).optional() })
      .strict(),
  },
  compare_etfs: {
    cost: 2,
    description:
      "Compare 2–3 supported ETFs from the same listing market: holdings overlap, exposure and source-date alignment. Do not mix Taiwan-listed and US-listed funds. 2 points.",
    schema: z
      .object({
        codes: group.refine((x) => x.length >= 2, "At least two distinct ETFs").refine((x) => x.every((c) => isGlobal(c) === isGlobal(x[0] ?? "")), "Compare ETFs from one listing market"),
      })
      .strict(),
  },
  get_stock_context: {
    cost: 2,
    description:
      "Find supported ETFs holding a stock and their observed changes. Four-to-six digit symbols default to Taiwan; set market='us' for an overseas ticker. 2 points.",
    schema: z.object({ symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9.-]{0,14}$/), market: z.enum(["tw", "us"]).optional() }).strict(),
  },
  build_research_brief: {
    cost: 3,
    description:
      "Build a factual research brief for up to three supported Taiwan-listed or US-listed ETFs, with latest holdings and changes. 13F excluded. 3 points total.",
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
  async function globalSnapshot(etfCode: string) {
    const config = globalByCode.get(etfCode)!;
    const row = await (await getDb()).collection<GlobalEtfSnapshot>("global_etf_snapshots").findOne(
      {
        etfCode,
        strategyType: { $ne: "13f" },
        sourceStatus: "ok",
        sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" },
        $or: [{ unusableReason: { $exists: false } }, { unusableReason: null } as unknown as Filter<GlobalEtfSnapshot>],
        rowCount: { $gt: 0 },
      },
      { sort: { sourceAsOf: -1, fetchedAt: -1 }, maxTimeMS: 15_000 },
    );
    return {
      code: etfCode,
      market: "us",
      name: config.fundName,
      issuer: config.issuer,
      sourceAsOf: row?.sourceAsOf ?? null,
      fetchedAt: row?.fetchedAt ?? null,
      sourceStatus: row?.sourceStatus ?? "unavailable",
      holdingCount: row?.holdings.length ?? 0,
      holdings: row?.holdings.map(({ positionKey, ticker, name, weightPercent, shares, marketValue, country, sector, assetType }) => ({ positionKey, ticker, name, weightPercent, shares, marketValue, country, sector, assetType })) ?? [],
      source: row?.sourceUrl ?? config.sourceUrl,
      note: "Issuer holdings are observations, not real-time quotes or proof of trades.",
    };
  }
  async function snapshot(etfCode: string) {
    if (isGlobal(etfCode)) return globalSnapshot(etfCode);
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
  async function globalChanges(etfCode: string, days: number, limit = 100) {
    const db = await getDb(),
      end = quotaDay(),
      start = quotaDay(Date.now() - (days - 1) * 86400_000);
    const validDates = (await db.collection<GlobalEtfSnapshot>("global_etf_snapshots").distinct("sourceAsOf", {
      etfCode,
      strategyType: { $ne: "13f" },
      sourceStatus: "ok",
      sourceAsOf: { $gte: start, $lte: end, $regex: "^\\d{4}-\\d{2}-\\d{2}$" },
      $or: [{ unusableReason: { $exists: false } }, { unusableReason: null } as unknown as Filter<GlobalEtfSnapshot>],
      rowCount: { $gt: 0 },
    }, { maxTimeMS: 10_000 })).filter((value): value is string => typeof value === "string");
    const rows = validDates.length ? await db.collection<GlobalEtfHoldingChange>("global_etf_holding_changes")
      .find({ etfCode, sourceAsOf: { $in: validDates } })
      .sort({ sourceAsOf: -1, positionKey: 1 })
      .limit(limit + 1)
      .maxTimeMS(15_000)
      .toArray() : [];
    return {
      code: etfCode,
      market: "us",
      period: { start, end },
      sourceAsOf: rows[0]?.sourceAsOf ?? null,
      observedDates: validDates.sort().reverse(),
      changes: rows.slice(0, limit).map(({ _id, ...row }) => row),
      limit,
      truncated: rows.length > limit,
      source: globalByCode.get(etfCode)!.sourceUrl,
      note: "Changes compare issuer snapshots; weight and market-value differences do not prove purchases or sales. Dates may differ by fund.",
    };
  }
  async function changes(etfCode: string, days: number, limit?: number) {
    if (isGlobal(etfCode)) return globalChanges(etfCode, days, limit);
    const db = await getDb(),
      end = quotaDay(),
      start = quotaDay(Date.now() - (days - 1) * 86400_000);
    const rows = await db
      .collection("etf_holding_changes")
      .find({ etfCode, tradeDate: { $gte: start, $lte: end } })
      .sort({ tradeDate: -1, stockId: 1 })
      .limit(limit ? limit + 1 : 10_001)
      .maxTimeMS(15_000)
      .toArray();
    if (!limit && rows.length > 10_000)
      throw new AgentError("result_too_large_use_shorter_period");
    return {
      code: etfCode,
      period: { start, end },
      sourceAsOf: rows[0]?.tradeDate ?? null,
      observedDates: [...new Set(rows.map((x) => x.tradeDate))],
      changes: publicRows(limit ? rows.slice(0, limit) : rows),
      ...(limit ? { limit, truncated: rows.length > limit } : {}),
      source: configuredEtfs.find((x) => x.etfCode === etfCode)!.source.infoUrl,
    };
  }
  return async (name, args) => {
    if (name === "search_market_entities") {
      const q = String(args.query).toLowerCase();
      const market = String(args.market ?? "all");
      const twRows = taiwanEtfs
        .filter(
          (x) =>
            `${x.etfCode} ${x.name} ${x.issuer}`.toLowerCase().includes(q),
        )
        .map((x) => ({
          code: x.etfCode,
          name: x.name,
          issuer: x.issuer,
          source: x.source.infoUrl,
          market: "tw",
        }));
      const usRows = globalEtfs
        .filter((x) => `${x.etfCode} ${x.fundName} ${x.issuer}`.toLowerCase().includes(q))
        .map((x) => ({ code: x.etfCode, name: x.fundName, issuer: x.issuer, source: x.sourceUrl, market: "us" }));
      const rows = market === "tw" ? twRows : market === "us" ? usRows : [...twRows, ...usRows];
      return {
        data: { market, results: rows },
        hasData: rows.length > 0,
      };
    }
    if (name === "get_etf_snapshot") {
      const data = await snapshot(String(args.code));
      return { data, hasData: data.holdings.length > 0 };
    }
    if (name === "get_etf_changes") {
      const data = await changes(String(args.code), Number(args.days), args.limit === undefined ? undefined : Number(args.limit));
      return { data, hasData: data.changes.length > 0 };
    }
    if (name === "compare_etfs") {
      const data = await compareEtfs(
        await getDb(),
        isGlobal((args.codes as string[])[0] ?? "") ? "global" : "tw",
        args.codes as string[],
      );
      return {
        data: data as unknown as Record<string, unknown>,
        hasData: data.cards.some((x) => x.sourceAsOf !== null),
      };
    }
    if (name === "get_stock_context") {
      const symbol = String(args.symbol);
      const market = (args.market as "tw" | "us" | undefined) ?? (/^\d{4,6}$/.test(symbol) ? "tw" : "us");
      const data = await stockEtfs(await getDb(), market, symbol);
      return {
        data: data as unknown as Record<string, unknown>,
        hasData: Array.isArray(data.rows) && data.rows.length > 0,
      };
    }
    if (name === "build_research_brief") {
      const funds = await Promise.all(
        (args.codes as string[]).map(async (c) => {
          const fullSnapshot = await snapshot(c);
          return {
            snapshot: isGlobal(c)
              ? { ...fullSnapshot, holdings: fullSnapshot.holdings.slice(0, 15), holdingsTruncated: fullSnapshot.holdings.length > 15 }
              : fullSnapshot,
            recentChanges: await changes(c, 7, isGlobal(c) ? 10 : undefined),
          };
        }),
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
