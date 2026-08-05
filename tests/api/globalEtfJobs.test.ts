import type { HttpRequest, InvocationContext } from "@azure/functions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enabledGlobalEtfs } from "../../src/config/globalEtfs.js";
import { getGlobalEtfSyncTargets } from "../../src/api/postGlobalEtfJobs.js";

function requestWithToken(token?: string): HttpRequest {
  return {
    headers: new Headers(token ? { "x-admin-token": token } : undefined)
  } as HttpRequest;
}

describe("Global ETF admin jobs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the current verified sync targets without opening a database connection", async () => {
    vi.stubEnv("ADMIN_JOB_TOKEN", "test-admin-token");

    const response = await getGlobalEtfSyncTargets(
      requestWithToken("test-admin-token"),
      {} as InvocationContext
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({
      etfCodes: enabledGlobalEtfs
        .filter((etf) => etf.enabled && etf.sourceStatus === "verified")
        .map((etf) => etf.etfCode),
      count: enabledGlobalEtfs.filter((etf) => etf.enabled && etf.sourceStatus === "verified").length
    });
  });

  it("requires the same admin token as the sync endpoints", async () => {
    vi.stubEnv("ADMIN_JOB_TOKEN", "test-admin-token");

    const response = await getGlobalEtfSyncTargets(
      requestWithToken("wrong-token"),
      {} as InvocationContext
    );

    expect(response.status).toBe(401);
  });
});
