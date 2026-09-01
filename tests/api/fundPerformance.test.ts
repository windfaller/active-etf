import type { HttpRequest, InvocationContext } from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(async () => ({ name: "db" })),
  verifyFirebaseIdToken: vi.fn(),
  fundPerformanceRankings: vi.fn(async () => ({
    generatedAt: "2026-08-17T04:00:00.000Z",
    sections: { tw: { rows: [] }, global: { rows: [] } }
  }))
}));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/auth/firebaseTokenVerifier.js", () => ({
  verifyFirebaseIdToken: mocks.verifyFirebaseIdToken
}));
vi.mock("../../src/services/performance/fundPerformanceService.js", () => ({
  fundPerformanceRankings: mocks.fundPerformanceRankings
}));

import { clearFundPerformanceRequestCache, getFundPerformance } from "../../src/api/getFundPerformance.js";

function request(query = "", cookie?: string): HttpRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return { query: new URLSearchParams(query), headers } as unknown as HttpRequest;
}

const context = { error: vi.fn() } as unknown as InvocationContext;

describe("fund performance API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyFirebaseIdToken.mockResolvedValue({ sub: "member-1" });
    clearFundPerformanceRequestCache();
  });

  it("returns both market sections with cache metadata", async () => {
    const response = await getFundPerformance(request("date=2026-08-14"), context);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ sections: { tw: { rows: [] }, global: { rows: [] } } });
    expect(mocks.fundPerformanceRankings).toHaveBeenCalledWith(expect.anything(), "2026-08-14");
    expect(new Headers(response.headers).get("Cache-Control")).toContain("private, no-store");
    expect(new Headers(response.headers).get("Vary")).toContain("Cookie");
  });

  it("rejects invalid dates before database access", async () => {
    const response = await getFundPerformance(request("date=not-a-date"), context);
    expect(response.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns only sentinels for locked anonymous rows and full rows for a verified member", async () => {
    mocks.fundPerformanceRankings.mockResolvedValue({
      generatedAt: "2026-08-17T04:00:00.000Z",
      sections: {
        tw: {
          rows: [
            { market: "tw", etfCode: "AAA", fundName: "SECRET_A" },
            { market: "tw", etfCode: "BBB", fundName: "SECRET_B" },
            { market: "tw", etfCode: "CCC", fundName: "SECRET_C" },
            { market: "tw", etfCode: "DDD", fundName: "SECRET_D" }
          ]
        },
        global: { rows: [] }
      }
    } as never);

    const anonymous = await getFundPerformance(request("date=2026-08-16"), context);
    const member = await getFundPerformance(request("date=2026-08-16", "active_etf_session=valid-token"), context);
    const anonymousJson = JSON.stringify(anonymous.jsonBody);
    const memberJson = JSON.stringify(member.jsonBody);

    expect(anonymousJson).toContain('"memberLocked":true');
    expect(["SECRET_A", "SECRET_B", "SECRET_C", "SECRET_D"].filter((value) => anonymousJson.includes(value)).length).toBeLessThan(4);
    expect(memberJson).toContain("SECRET_A");
    expect(memberJson).toContain("SECRET_D");
    expect(mocks.verifyFirebaseIdToken).toHaveBeenCalledWith("valid-token");
  });

  it("does not leak upstream or database errors", async () => {
    mocks.fundPerformanceRankings.mockRejectedValueOnce(new Error("private upstream details"));
    const response = await getFundPerformance(request(), context);
    expect(response.status).toBe(500);
    expect(response.jsonBody).toEqual({ error: "fund performance ranking is temporarily unavailable" });
  });
});
