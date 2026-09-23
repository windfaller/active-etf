import { describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { createResearchProvider, toolDefinitions } from "../../src/mcp/data.js";
import { quotaDay } from "../../src/mcp/core.js";

describe("overseas ETF MCP contract", () => {
  it("discovers US-listed funds without exposing 13F portfolios", async () => {
    const provider = createResearchProvider(async () => { throw Error("search must not query MongoDB"); });
    const result = await provider("search_market_entities", { query: "", market: "us" });
    const codes = (result.data.results as Array<{ code: string }>).map((row) => row.code);
    expect(codes).toContain("DRAM");
    expect(codes).toContain("NASA");
    expect(codes).not.toContain("ARK13F");
    expect(toolDefinitions.get_etf_snapshot.schema.safeParse({ code: "dram" }).success).toBe(true);
    expect(toolDefinitions.get_etf_snapshot.schema.safeParse({ code: "ARK13F" }).success).toBe(false);
    expect(toolDefinitions.compare_etfs.schema.safeParse({ codes: ["DRAM", "NASA"] }).success).toBe(true);
    expect(toolDefinitions.compare_etfs.schema.safeParse({ codes: ["DRAM", "00981A"] }).success).toBe(false);
    expect(toolDefinitions.get_stock_context.schema.safeParse({ symbol: "MU", market: "us" }).success).toBe(true);
  });

  it("returns sourced overseas holdings, limits change rows, and bounds a research brief", async () => {
    const today = quotaDay();
    const holding = (i: number) => ({ positionKey: `ticker:T${i}`, ticker: `T${i}`, name: `Stock ${i}`, weightPercent: 1, sourceUrl: "https://issuer.example/", raw: { private: true } });
    const snapshot = {
      etfCode: "DRAM", fundName: "Memory ETF", issuer: "Issuer", sourceAsOf: today,
      fetchedAt: new Date(), sourceUrl: "https://issuer.example/", sourceStatus: "ok",
      rowCount: 20, holdings: Array.from({ length: 20 }, (_, i) => holding(i)),
    };
    const rows = Array.from({ length: 3 }, (_, i) => ({ etfCode: "DRAM", sourceAsOf: today, prevSourceAsOf: "2026-09-22", positionKey: `ticker:T${i}`, name: `Stock ${i}`, status: "increase" }));
    const cursor = { sort() { return this; }, limit(n: number) { return { maxTimeMS() { return { toArray: async () => rows.slice(0, n) }; } }; } };
    const db = { collection(name: string) {
      if (name === "global_etf_snapshots") return {
        findOne: async (query: Record<string, unknown>) => {
          expect(query).toMatchObject({ etfCode: "DRAM", sourceStatus: "ok", $or: [{ unusableReason: { $exists: false } }, { unusableReason: null }] });
          return snapshot;
        },
        distinct: async () => [today],
      };
      if (name === "global_etf_holding_changes") return { find: () => cursor };
      throw Error(`Unexpected collection ${name}`);
    } } as unknown as Db;
    const provider = createResearchProvider(async () => db);
    const snap = await provider("get_etf_snapshot", { code: "DRAM" });
    expect(snap.hasData).toBe(true);
    expect(snap.data).toMatchObject({ code: "DRAM", market: "us", sourceAsOf: today, holdingCount: 20, source: "https://issuer.example/" });
    expect(JSON.stringify(snap.data)).not.toContain("private");
    const changes = await provider("get_etf_changes", { code: "DRAM", days: 7, limit: 2 });
    expect(changes.data).toMatchObject({ truncated: true, limit: 2, observedDates: [today] });
    expect((changes.data.changes as unknown[])).toHaveLength(2);
    const brief = await provider("build_research_brief", { codes: ["DRAM"] });
    const fund = (brief.data.funds as Array<{ snapshot: { holdings: unknown[]; holdingCount: number; holdingsTruncated: boolean } }>)[0]!;
    expect(fund.snapshot.holdings).toHaveLength(15);
    expect(fund.snapshot.holdingCount).toBe(20);
    expect(fund.snapshot.holdingsTruncated).toBe(true);
  });
});
