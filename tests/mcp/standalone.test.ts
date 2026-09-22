import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpRequest } from "@azure/functions";
const registrations = vi.hoisted(() => vi.fn());
vi.mock("@azure/functions", async (original) => ({...await original<typeof import("@azure/functions")>(), app: {http: registrations}}));
let handler: typeof import("../../src/mcp/standalone.js").standaloneMcp;
beforeAll(async () => { vi.stubEnv("MCP_STANDALONE", "true"); handler = (await import("../../src/mcp/standalone.js")).standaloneMcp; });
afterAll(() => vi.unstubAllEnvs());
describe("independent MCP Function isolation", () => {
  it("registers only the standalone HTTP entry, without market timers or duplicate managed routes", () => {
    expect(registrations.mock.calls.map(c=>c[0])).toEqual(["standaloneMcp"]);
  });
  it("does not expose hidden Skill pages, downloads or filesystem traversal", async () => {
    for (const path of ["/en/mcp/skill", "/zh-TW/mcp/skill/index.html", "/skills/en/active-etf-research/SKILL.md", "/assets/%2e%2e%2fpackage.json", "/package.json"]) {
      const result=await handler(new HttpRequest({url:"https://mcp.example"+path,method:"GET"}));
      expect(result.status).toBe(404);
    }
  });
});
