import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpRequest } from "@azure/functions";
const registrations = vi.hoisted(() => vi.fn());
vi.mock("@azure/functions", async (original) => ({...await original<typeof import("@azure/functions")>(), app: {http: registrations}}));
vi.mock("node:fs/promises", () => ({readFile: vi.fn(async (path: string) => {
  if (["/zh-TW/mcp/skill/index.html", "/zh-TW/mcp/connect/index.html", "/skills/zh-TW/active-etf-research/SKILL.md", "/sitemap.xml", "/robots.txt"].some(suffix => path.endsWith(suffix))) return Buffer.from("fixture");
  throw new Error("ENOENT");
})}));
let handler: typeof import("../../src/mcp/standalone.js").standaloneMcp;
beforeAll(async () => { vi.stubEnv("MCP_STANDALONE", "true"); handler = (await import("../../src/mcp/standalone.js")).standaloneMcp; });
afterAll(() => vi.unstubAllEnvs());
describe("independent MCP Function isolation", () => {
  it("registers only the standalone HTTP entry, without market timers or duplicate managed routes", () => {
    expect(registrations.mock.calls.map(c=>c[0])).toEqual(["standaloneMcp"]);
  });
  it("serves public guides and sitemap while keeping connections and raw files out of search", async () => {
    for (const path of ["/zh-TW/mcp/skill", "/skills/zh-TW/active-etf-research/SKILL.md", "/sitemap.xml", "/robots.txt"]) {
      const result=await handler(new HttpRequest({url:"https://mcp.example"+path,method:"GET"}));
      expect(result.status).toBe(200);
      expect(new Headers(result.headers).get("X-Robots-Tag")).toBe(path === "/zh-TW/mcp/skill" || path === "/sitemap.xml" || path === "/robots.txt" ? null : "noindex, nofollow");
    }
    const connect=await handler(new HttpRequest({url:"https://mcp.example/zh-TW/mcp/connect",method:"GET"}));
    expect(new Headers(connect.headers).get("X-Robots-Tag")).toBe("noindex, nofollow");
    for (const path of ["/zh-TW/mcp/skill/index.html", "/assets/%2e%2e%2fpackage.json", "/package.json"]) {
      const result=await handler(new HttpRequest({url:"https://mcp.example"+path,method:"GET"}));
      expect(result.status).toBe(404);
    }
  });
});
