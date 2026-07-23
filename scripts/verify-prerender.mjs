import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function html(path) { return readFileSync(resolve(process.cwd(), "dist", path, "index.html"), "utf8"); }
function includesAll(body, values) { for (const value of values) assert.ok(body.includes(value), `Expected HTML to contain: ${value}`); }

const home = html("");
const market = html("market");
const etf = html("etf/00981A");
const changes = html("etf/00981A/changes");
const dram = html("global-etfs/DRAM");
const stockTw = html("stocks/tw/2330");
const stockUs = html("stocks/us/MU");
const compare = html("compare/etfs");
const reversals = html("signals/reversals");
const style = html("etf/00981A/style");
const methodology = html("methodology");

includesAll(market, ["<h1>台灣主動式 ETF 市場總覽</h1>", `${"rel=\"canonical\" href=\"https://active-etf.inthewins.com/market\""}`, "BreadcrumbList"]);
includesAll(etf, ["00981A 主動統一台股增長", "統一投信", "https://active-etf.inthewins.com/etf/00981A"]);
assert.notEqual(etf.match(/<title>(.*?)<\/title>/u)?.[1], changes.match(/<title>(.*?)<\/title>/u)?.[1]);
includesAll(dram, ["DRAM Roundhill Memory ETF", "https://active-etf.inthewins.com/global-etfs/DRAM"]);
includesAll(stockTw, ["2330 台積電", "https://active-etf.inthewins.com/stocks/tw/2330", "BreadcrumbList", "Dataset"]);
includesAll(stockUs, ["MU Micron Technology", "https://active-etf.inthewins.com/stocks/us/MU", "資料日期"]);
includesAll(compare, ["ETF 多檔比較工具", "https://active-etf.inthewins.com/compare/etfs"]);
includesAll(reversals, ["方向反轉訊號", "https://active-etf.inthewins.com/signals/reversals"]);
includesAll(style, ["00981A 主動統一台股增長經理人風格", "https://active-etf.inthewins.com/etf/00981A/style"]);
includesAll(methodology, ["情報指標方法論與限制", "https://active-etf.inthewins.com/methodology"]);
for (const body of [market, etf, changes, dram, stockTw, stockUs, compare, reversals, style, methodology]) assert.ok(!body.includes("active-etf.chicoo.co"));
for (const [route, body] of [["/", home], ["/market", market], ["/compare/etfs", compare], ["/signals/reversals", reversals], ["/methodology", methodology]]) {
  assert.ok(!body.includes('"@type":"Dataset"'), `${route} must not be marked as a Dataset`);
}
for (const [route, body] of [["/etf/00981A", etf], ["/etf/00981A/changes", changes], ["/global-etfs/DRAM", dram], ["/stocks/tw/2330", stockTw]]) {
  const match = body.match(/<script id="route-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/u);
  assert.ok(match, `${route} must include JSON-LD`);
  const dataset = JSON.parse(match[1]).find((item) => item["@type"] === "Dataset");
  assert.ok(dataset, `${route} must include a Dataset`);
  const descriptionLength = Array.from(dataset.description).length;
  assert.ok(descriptionLength >= 50 && descriptionLength <= 5_000, `${route} Dataset description must contain 50-5000 characters`);
  assert.ok(!Object.hasOwn(dataset, "license"), `${route} must not publish an unverified license`);
}
const deploymentConfig = JSON.parse(readFileSync(resolve(process.cwd(), "dist/staticwebapp.config.json"), "utf8"));
const routeMap = new Map(deploymentConfig.routes.map((entry) => [entry.route, entry]));
assert.equal(routeMap.get("/market")?.rewrite, "/market/index.html");
assert.equal(routeMap.get("/etf/00981A")?.rewrite, "/etf/00981A/index.html");
assert.equal(routeMap.get("/etf/00981A/changes")?.rewrite, "/etf/00981A/changes/index.html");
assert.equal(routeMap.get("/global-etfs/DRAM")?.rewrite, "/global-etfs/DRAM/index.html");
assert.equal(routeMap.get("/stocks/tw/2330")?.rewrite, "/stocks/tw/2330/index.html");
assert.equal(routeMap.get("/compare/etfs")?.rewrite, "/compare/etfs/index.html");
assert.equal(routeMap.get("/signals/reversals")?.rewrite, "/signals/reversals/index.html");
assert.equal(routeMap.get("/etf/00981A/style")?.rewrite, "/etf/00981A/style/index.html");
assert.equal(routeMap.has("/etf/UNKNOWN"), false);
assert.ok(!JSON.stringify(deploymentConfig).includes("index-cTTlnrt5"));
console.log("Prerender SEO verification passed.");
