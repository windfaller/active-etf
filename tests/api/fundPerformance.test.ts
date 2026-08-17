import type { HttpRequest, InvocationContext } from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(async () => ({ name: "db" })),
  fundPerformanceRankings: vi.fn(async () => ({
    generatedAt: "2026-08-17T04:00:00.000Z",
    sections: { tw: { rows: [] }, global: { rows: [] } }
  }))
}));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/performance/fundPerformanceService.js", () => ({
  fundPerformanceRankings: mocks.fundPerformanceRankings
}));

import { clearFundPerformanceRequestCache, getFundPerformance } from "../../src/api/getFundPerformance.js";

function request(query = ""): HttpRequest {
  return { query: new URLSearchParams(query) } as unknown as HttpRequest;
}

const context = { error: vi.fn() } as unknown as InvocationContext;

describe("fund performance API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFundPerformanceRequestCache();
  });

  it("returns both market sections with cache metadata", async () => {
    const response = await getFundPerformance(request("date=2026-08-14"), context);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ sections: { tw: { rows: [] }, global: { rows: [] } } });
    expect(mocks.fundPerformanceRankings).toHaveBeenCalledWith(expect.anything(), "2026-08-14");
    expect(new Headers(response.headers).get("Cache-Control")).toContain("s-maxage=1800");
  });

  it("rejects invalid dates before database access", async () => {
    const response = await getFundPerformance(request("date=not-a-date"), context);
    expect(response.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("does not leak upstream or database errors", async () => {
    mocks.fundPerformanceRankings.mockRejectedValueOnce(new Error("private upstream details"));
    const response = await getFundPerformance(request(), context);
    expect(response.status).toBe(500);
    expect(response.jsonBody).toEqual({ error: "fund performance ranking is temporarily unavailable" });
  });
});
