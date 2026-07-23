import type { HttpRequest, InvocationContext } from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  command: vi.fn(async () => ({ ok: 1 })),
  getDb: vi.fn()
}));

mocks.getDb.mockImplementation(async () => ({ command: mocks.command }));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));

import { getHealth } from "../../src/api/getHealth.js";

function context(): InvocationContext {
  return { error: vi.fn() } as unknown as InvocationContext;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockImplementation(async () => ({ command: mocks.command }));
    mocks.command.mockResolvedValue({ ok: 1 });
  });

  it("reports readiness only after MongoDB responds", async () => {
    const response = await getHealth({} as HttpRequest, context());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      ok: true,
      status: "ready",
      service: "active-etf-api"
    });
    expect(new Headers(response.headers).get("Cache-Control")).toContain("no-store");
    expect(mocks.command).toHaveBeenCalledWith({ ping: 1 });
  });

  it("returns a non-sensitive 503 when the dependency is unavailable", async () => {
    mocks.command.mockRejectedValueOnce(new Error("mongodb secret connection text"));
    const invocationContext = context();

    const response = await getHealth({} as HttpRequest, invocationContext);

    expect(response.status).toBe(503);
    expect(response.jsonBody).toMatchObject({
      ok: false,
      status: "unavailable",
      service: "active-etf-api"
    });
    expect(JSON.stringify(response.jsonBody)).not.toContain("mongodb secret");
    expect(invocationContext.error).toHaveBeenCalled();
  });
});
