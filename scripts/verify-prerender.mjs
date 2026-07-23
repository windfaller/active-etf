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
const search = html("search");
const notFound = html("404");
const dynamicStock = html("stocks/_dynamic");

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
includesAll(search, ["<meta name=\"robots\" content=\"noindex, nofollow\"", "https://active-etf.inthewins.com/search"]);
includesAll(notFound, ["<h1>找不到頁面</h1>", "<meta name=\"robots\" content=\"noindex, nofollow\""]);
includesAll(dynamicStock, ["<h1>股票 ETF 持股與調倉</h1>", "<meta name=\"robots\" content=\"noindex, nofollow\""]);
for (const body of [market, etf, changes, dram, stockTw, stockUs, compare, reversals, style, methodology, search]) assert.ok(!body.includes("active-etf.chicoo.co"));
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
const deploymentConfigPath = resolve(process.cwd(), "dist/staticwebapp.config.json");
const deploymentConfigRaw = readFileSync(deploymentConfigPath, "utf8");
assert.ok(
  Buffer.byteLength(deploymentConfigRaw, "utf8") <= 20 * 1024,
  "staticwebapp.config.json must stay within the Azure Static Web Apps 20 KB limit"
);
const deploymentConfig = JSON.parse(deploymentConfigRaw);
const routeMap = new Map(deploymentConfig.routes.map((entry) => [entry.route, entry]));
assert.equal(routeMap.has("/market"), false);
assert.equal(routeMap.has("/etf/00981A"), false);
assert.equal(routeMap.has("/etf/00981A/changes"), false);
assert.equal(routeMap.has("/global-etfs/DRAM"), false);
assert.equal(routeMap.get("/stocks/tw/2330")?.rewrite, "/stocks/tw/2330/index.html");
assert.equal(routeMap.get("/stocks/us/MU")?.rewrite, "/stocks/us/MU/index.html");
assert.equal(routeMap.has("/compare/etfs"), false);
assert.equal(routeMap.has("/signals/reversals"), false);
assert.equal(routeMap.has("/etf/00981A/style"), false);
assert.equal(routeMap.has("/etf/UNKNOWN"), false);
assert.equal(routeMap.get("/stocks/tw/*")?.rewrite, "/stocks/_dynamic/index.html");
assert.equal(routeMap.get("/stocks/us/*")?.rewrite, "/stocks/_dynamic/index.html");
assert.equal(routeMap.has("/*"), false);
assert.equal(deploymentConfig.responseOverrides?.["404"]?.rewrite, "/404/index.html");
assert.equal(deploymentConfig.navigationFallback, undefined);
assert.ok(market.includes("class=\"seo-live-data\"") || !market.includes("dateModified"), "Market prerender must use live data or omit dateModified");
assert.ok(!JSON.stringify(deploymentConfig).includes("index-cTTlnrt5"));
console.log("Prerender SEO verification passed.");
