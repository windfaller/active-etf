import assert from "node:assert/strict";

const baseUrl = (process.env.PRODUCTION_BASE_URL ?? process.argv[2] ?? "https://active-etf.inthewins.com").replace(/\/+$/u, "");
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const attempts = 4;
const requestTimeoutMs = 30_000;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(path, expectedStatus = 200) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          accept: path.startsWith("/api/") ? "application/json" : "*/*",
          "cache-control": "no-cache"
        },
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
      const body = await response.text();
      if (response.status === expectedStatus) {
        return {
          body,
          cacheControl: response.headers.get("cache-control"),
          contentType: response.headers.get("content-type"),
          durationMs: Math.round(performance.now() - startedAt),
          status: response.status
        };
      }
      lastError = new Error(`${path} returned ${response.status}, expected ${expectedStatus}: ${body.slice(0, 300)}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await delay(attempt * 2_000);
  }
  throw lastError;
}

function parseJson(result, path) {
  assert.match(result.contentType ?? "", /application\/json/iu, `${path} must return JSON`);
  return JSON.parse(result.body);
}

const healthResult = await request("/api/health?source=production-smoke");
const health = parseJson(healthResult, "/api/health");
assert.equal(health.ok, true);
assert.equal(health.status, "ready");

const [
  versionResult,
  taiwanOverviewResult,
  usHistoryResult,
  comparisonResult,
  signalsResult,
  styleResult,
  searchResult,
  signalsPageResult,
  knownStockPageResult,
  notFoundResult,
  sitemapResult
] = await Promise.all([
  request("/app-version.json"),
  request("/api/stocks/tw/2330/overview"),
  request("/api/stocks/us/MU/history?window=20"),
  request("/api/compare/etfs?type=tw&codes=00981A,00982A"),
  request("/api/signals?kind=all&window=20&limit=30"),
  request("/api/etf/00981A/style?window=20"),
  request("/api/search?q=%E5%8F%B0%E7%A9%8D%E9%9B%BB&limit=12"),
  request("/signals"),
  request("/stocks/tw/2330"),
  request("/production-smoke-not-found", 404),
  request("/sitemap.xml")
]);

const version = parseJson(versionResult, "/app-version.json");
assert.equal(typeof version.version, "string");
assert.ok(version.version.length >= 7, "app-version.json must expose a deploy version");

const taiwanOverview = parseJson(taiwanOverviewResult, "/api/stocks/tw/2330/overview");
assert.equal(taiwanOverview.found, true);
assert.match(taiwanOverview.sourceAsOf, isoDatePattern);
assert.equal(taiwanOverview.stock?.symbol, "2330");

const usHistory = parseJson(usHistoryResult, "/api/stocks/us/MU/history");
assert.equal(usHistory.market, "us");
assert.match(usHistory.sourceAsOf, isoDatePattern);
assert.match(usHistory.timeScale, /變動點/u);
assert.ok(Array.isArray(usHistory.points) && usHistory.points.length > 0, "US history must contain comparable change points");
for (const point of usHistory.points) {
  assert.match(point.date, isoDatePattern);
  assert.equal(typeof point.weightChangePercentPoints, "number");
  assert.ok(["increase", "decrease", "neutral"].includes(point.direction));
  assert.equal(Object.hasOwn(point, "totalWeightPercent"), false);
}

const comparison = parseJson(comparisonResult, "/api/compare/etfs");
assert.equal(comparison.cards?.length, 2);
const signals = parseJson(signalsResult, "/api/signals");
for (const key of ["consecutive", "reversals", "divergences"]) assert.ok(Array.isArray(signals[key]), `signals.${key} must be an array`);
const style = parseJson(styleResult, "/api/etf/00981A/style");
assert.equal(style.etf?.code, "00981A");
const search = parseJson(searchResult, "/api/search");
assert.ok(Array.isArray(search.results));

assert.match(signalsPageResult.body, /<h1>連續調倉、反轉與分歧訊號<\/h1>/u);
assert.match(signalsPageResult.body, /rel="canonical" href="https:\/\/active-etf\.inthewins\.com\/signals"/u);
assert.match(knownStockPageResult.body, /<h1>2330 台積電<\/h1>/u);
assert.match(knownStockPageResult.body, /content="index, follow"/u);
assert.match(notFoundResult.body, /<h1>找不到頁面<\/h1>/u);
assert.match(notFoundResult.body, /content="noindex, nofollow"/u);

const sitemapUrlCount = (sitemapResult.body.match(/<url>/gu) ?? []).length;
assert.ok(sitemapUrlCount >= 150, `sitemap must retain P0/P1 coverage, received ${sitemapUrlCount} URLs`);
assert.equal(sitemapResult.body.includes("active-etf.chicoo.co"), false);

console.log(JSON.stringify({
  baseUrl,
  health: { durationMs: healthResult.durationMs, status: healthResult.status },
  version: version.version,
  checks: {
    comparisonCards: comparison.cards.length,
    searchResults: search.results.length,
    signalRows: signals.consecutive.length + signals.reversals.length + signals.divergences.length,
    sitemapUrlCount,
    usHistoryChangePoints: usHistory.points.length
  },
  latencyMs: {
    comparison: comparisonResult.durationMs,
    signals: signalsResult.durationMs,
    style: styleResult.durationMs,
    taiwanOverview: taiwanOverviewResult.durationMs,
    usHistory: usHistoryResult.durationMs
  }
}, null, 2));
