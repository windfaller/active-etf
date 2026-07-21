import type { HttpRequest, InvocationContext } from "@azure/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(async () => ({ name: "db" })),
  ensureP1IntelligenceIndexes: vi.fn(async () => ["holdings_stock_history", "global_etf_history", "global_holding_lookup"])
}));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/db/indexes.js", () => ({ ensureP1IntelligenceIndexes: mocks.ensureP1IntelligenceIndexes }));

import { postEnsureP1Indexes } from "../../src/api/postEtfAdminJobs.js";

const originalAdminToken = process.env.ADMIN_JOB_TOKEN;
const context = {} as InvocationContext;

function request(token?: string): HttpRequest {
  return {
    headers: new Headers(token ? { "x-admin-token": token } : {}),
    query: new URLSearchParams(),
    params: {}
  } as unknown as HttpRequest;
}

describe("P1 index administration job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_JOB_TOKEN = "expected-secret";
  });

  afterEach(() => {
    if (originalAdminToken === undefined) delete process.env.ADMIN_JOB_TOKEN;
    else process.env.ADMIN_JOB_TOKEN = originalAdminToken;
  });

  it("rejects a missing or invalid admin token before database access", async () => {
    delete process.env.ADMIN_JOB_TOKEN;
    expect((await postEnsureP1Indexes(request(), context)).status).toBe(500);
    process.env.ADMIN_JOB_TOKEN = "expected-secret";
    expect((await postEnsureP1Indexes(request(), context)).status).toBe(401);
    expect((await postEnsureP1Indexes(request("wrong-secret"), context)).status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.ensureP1IntelligenceIndexes).not.toHaveBeenCalled();
  });

  it("runs only the bounded P1 index ensure operation for an authorized request", async () => {
    const response = await postEnsureP1Indexes(request("expected-secret"), context);

    expect(response).toMatchObject({
      status: 200,
      jsonBody: { ok: true, job: "ensureP1Indexes", result: { ensured: 3 } }
    });
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
    expect(mocks.ensureP1IntelligenceIndexes).toHaveBeenCalledTimes(1);
    expect(mocks.ensureP1IntelligenceIndexes).toHaveBeenCalledWith(await mocks.getDb.mock.results[0]?.value);
  });
});
