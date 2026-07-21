import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function html(path) { return readFileSync(resolve(process.cwd(), "dist", path, "index.html"), "utf8"); }
function includesAll(body, values) { for (const value of values) assert.ok(body.includes(value), `Expected HTML to contain: ${value}`); }

const market = html("market");
const etf = html("etf/00981A");
const changes = html("etf/00981A/changes");
const dram = html("global-etfs/DRAM");

includesAll(market, ["<h1>台灣主動式 ETF 市場總覽</h1>", `${"rel=\"canonical\" href=\"https://active-etf.inthewins.com/market\""}`, "BreadcrumbList"]);
includesAll(etf, ["00981A 主動統一台股增長", "統一投信", "https://active-etf.inthewins.com/etf/00981A"]);
assert.notEqual(etf.match(/<title>(.*?)<\/title>/u)?.[1], changes.match(/<title>(.*?)<\/title>/u)?.[1]);
includesAll(dram, ["DRAM Roundhill Memory ETF", "https://active-etf.inthewins.com/global-etfs/DRAM"]);
for (const body of [market, etf, changes, dram]) assert.ok(!body.includes("active-etf.chicoo.co"));
const deploymentConfig = JSON.parse(readFileSync(resolve(process.cwd(), "dist/staticwebapp.config.json"), "utf8"));
const routeMap = new Map(deploymentConfig.routes.map((entry) => [entry.route, entry]));
assert.equal(routeMap.get("/market")?.rewrite, "/market/index.html");
assert.equal(routeMap.get("/etf/00981A")?.rewrite, "/etf/00981A/index.html");
assert.equal(routeMap.get("/etf/00981A/changes")?.rewrite, "/etf/00981A/changes/index.html");
assert.equal(routeMap.get("/global-etfs/DRAM")?.rewrite, "/global-etfs/DRAM/index.html");
assert.equal(routeMap.has("/etf/UNKNOWN"), false);
assert.ok(!JSON.stringify(deploymentConfig).includes("index-cTTlnrt5"));
console.log("Prerender SEO verification passed.");
