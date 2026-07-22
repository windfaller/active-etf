import { performance } from "node:perf_hooks";

const baseUrl = (process.env.BASE_URL ?? "https://active-etf.inthewins.com").replace(/\/+$/u, "");
const expectedVersion = process.env.EXPECTED_VERSION?.trim() || null;
const indexesEnsured = process.env.INDEXES_ENSURED === "true" ? true : "unverified";
const legacyBaseUrl = (process.env.LEGACY_BASE_URL ?? "https://active-etf.chicoo.co").replace(/\/+$/u, "");
const checkLegacyRedirect = process.env.CHECK_LEGACY_REDIRECT === "true";
const maximumAttempts = Math.max(1, Number(process.env.SMOKE_MAX_ATTEMPTS ?? 7));
const retryDelayMs = Math.max(100, Number(process.env.SMOKE_RETRY_DELAY_MS ?? 10_000));
const failures = [];
const durations = {};

const htmlRoutes = [
  ["/", "主動 ETF 機構調倉情報"],
  ["/market", "台灣主動式 ETF 市場總覽"],
  ["/stocks/tw/2330", "2330 台積電"],
  ["/stocks/us/MU", "MU Micron Technology"],
  ["/compare/etfs", "ETF 多檔比較工具"],
  ["/signals", "連續調倉、反轉與分歧訊號"],
  ["/methodology", "情報指標方法論與限制"]
];

const apiRoutes = [
  ["marketBootstrap", "/api/market/bootstrap?limit=10"],
  ["compare", "/api/compare/etfs?type=tw&codes=00981A,00982A"],
  ["signals", "/api/signals?kind=consecutive&window=5&limit=10"],
  ["style", "/api/etf/00981A/style?window=20"],
  ["twStockOverview", "/api/stocks/tw/2330/overview"],
  ["usStockOverview", "/api/stocks/us/MU/overview"],
  ["usStockHistory", "/api/stocks/us/MU/history?window=20"]
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const fail = (message) => failures.push(message);

async function fetchTimed(url, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60_000), ...options });
  const durationMs = Math.round(performance.now() - startedAt);
  return { response, durationMs };
}

async function fetchWithPropagationRetry(path, predicate) {
  let last = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      last = await fetchTimed(`${baseUrl}${path}`, { cache: "no-store" });
      if (await predicate(last.response)) return last;
      if (last.response.status !== 404 && last.response.status < 500) break;
    } catch (error) {
      last = { error };
    }
    if (attempt < maximumAttempts) await delay(retryDelayMs);
  }
  return last;
}

function canonicalFor(path) {
  return `https://active-etf.inthewins.com${path}`;
}

async function checkVersion() {
  let parsedVersion = null;
  const result = await fetchWithPropagationRetry("/app-version.json", async (response) => {
    if (response.status !== 200) return false;
    try {
      const body = await response.clone().json();
      parsedVersion = typeof body.version === "string" ? body.version : null;
      return !expectedVersion || parsedVersion === expectedVersion;
    } catch {
      return false;
    }
  });
  if (!result?.response || result.response.status !== 200) return fail("app-version.json did not return HTTP 200");
  if (!parsedVersion) fail("app-version.json has no string version");
  if (expectedVersion && parsedVersion !== expectedVersion) fail(`app version ${parsedVersion ?? "missing"} does not equal ${expectedVersion}`);
  if (!/no-store/iu.test(result.response.headers.get("cache-control") ?? "")) fail("app-version.json Cache-Control is not no-store");
  return parsedVersion;
}

async function checkHtml() {
  let firstHtml = "";
  for (const [path, expectedH1] of htmlRoutes) {
    const { response, durationMs } = await fetchTimed(`${baseUrl}${path}`, { cache: "no-store" });
    durations[`html ${path}`] = durationMs;
    const html = await response.text();
    if (path === "/") firstHtml = html;
    if (response.status !== 200) fail(`${path} returned HTTP ${response.status}`);
    if (!/<title>[^<]+<\/title>/iu.test(html)) fail(`${path} has no route title`);
    if (!new RegExp(`<h1[^>]*>\\s*${expectedH1.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*</h1>`, "iu").test(html)) fail(`${path} has the wrong H1`);
    if (!html.includes(`rel="canonical" href="${canonicalFor(path)}"`)) fail(`${path} has the wrong canonical`);
    if (/active-etf\.chicoo\.co/iu.test(html)) fail(`${path} still contains the legacy canonical host`);
    if (!/no-cache/iu.test(response.headers.get("cache-control") ?? "") || !/must-revalidate/iu.test(response.headers.get("cache-control") ?? "")) fail(`${path} HTML Cache-Control is not no-cache, must-revalidate`);
  }

  const searchPath = "/search?q=MU";
  const searchResponse = await fetch(`${baseUrl}${searchPath}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  const searchHtml = await searchResponse.text();
  if (!/<meta name="robots" content="noindex, nofollow"/iu.test(searchHtml)) fail(`${searchPath} is not noindex`);

  const compareQueryPath = "/compare/etfs?type=global&codes=DRAM,HBMX";
  const compareQueryResponse = await fetch(`${baseUrl}${compareQueryPath}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  const compareQueryHtml = await compareQueryResponse.text();
  const compareIsNoIndex = /<meta name="robots" content="noindex, nofollow"/iu.test(compareQueryHtml);
  const compareHasStableCanonical = compareQueryHtml.includes(`rel="canonical" href="${canonicalFor("/compare/etfs")}"`);
  if (!compareIsNoIndex && !compareHasStableCanonical) fail(`${compareQueryPath} has neither noindex nor a stable canonical`);

  const assetPath = firstHtml.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/u)?.[1];
  if (!assetPath) return fail("home HTML has no hashed asset");
  const assetResponse = await fetch(`${baseUrl}${assetPath}`, { method: "HEAD", signal: AbortSignal.timeout(60_000) });
  if (assetResponse.status !== 200) fail(`${assetPath} returned HTTP ${assetResponse.status}`);
  if (!/public/iu.test(assetResponse.headers.get("cache-control") ?? "") || !/max-age=31536000/iu.test(assetResponse.headers.get("cache-control") ?? "") || !/immutable/iu.test(assetResponse.headers.get("cache-control") ?? "")) fail(`${assetPath} is missing immutable one-year caching`);
}

async function fetchJson(name, path) {
  const { response, durationMs } = await fetchTimed(`${baseUrl}${path}`, { cache: "no-store" });
  durations[`api ${name}`] = durationMs;
  if (response.status >= 500) fail(`${path} returned HTTP ${response.status}`);
  if (!response.ok) {
    fail(`${path} returned HTTP ${response.status}`);
    return null;
  }
  try {
    return await response.json();
  } catch {
    fail(`${path} did not return parseable JSON`);
    return null;
  }
}

async function checkApis() {
  const results = Object.fromEntries(await Promise.all(apiRoutes.map(async ([name, path]) => [name, await fetchJson(name, path)])));
  const bootstrap = results.marketBootstrap;
  if (!bootstrap?.selectedDate) fail("market bootstrap has no selectedDate");
  const coverage = Array.isArray(bootstrap?.coverage) ? bootstrap.coverage : [];
  const expectedRecommended = coverage.find((row) => Number(row.coverageRate) >= 0.7)?.date
    ?? [...coverage].sort((left, right) => Number(right.availableCount) - Number(left.availableCount) || String(right.date).localeCompare(String(left.date)))[0]?.date
    ?? bootstrap?.dates?.[0]
    ?? null;
  if (expectedRecommended && bootstrap?.recommendedDate !== expectedRecommended) fail("recommended market date does not follow the coverage rule");
  if (!Array.isArray(results.compare?.cards) || results.compare.cards.length === 0) fail("compare cards are empty");
  if (!results.signals?.coverage || !Object.prototype.hasOwnProperty.call(results.signals, "sourceAsOf")) fail("signals schema is missing coverage or sourceAsOf");
  if (!results.style?.period || !results.style?.etf) fail("style schema is missing period or ETF");
  if (!results.twStockOverview?.stock || !results.usStockOverview?.stock) fail("stock overview schema is incomplete");
  const historyPoints = Array.isArray(results.usStockHistory?.points) ? results.usStockHistory.points : [];
  if (historyPoints.some((point) => !/^\d{4}-\d{2}-\d{2}$/u.test(point.date))) fail("US stock history contains a non-ISO date");
  if (historyPoints.some((point) => !Number.isInteger(point.etfCount) || point.etfCount < 1)) fail("US stock history has an invalid unique ETF count");
  if (!results.usStockHistory?.summary || !Object.prototype.hasOwnProperty.call(results.usStockHistory.summary, "periodWeightChangePoint")) fail("US stock history summary is missing weight semantics");
  return bootstrap;
}

async function checkLegacy() {
  if (!checkLegacyRedirect) return;
  for (const path of ["/", "/market", "/etf/00981A/changes?date=2026-07-20"]) {
    const response = await fetch(`${legacyBaseUrl}${path}`, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    if (response.status !== 301) fail(`legacy ${path} returned HTTP ${response.status}, expected 301`);
    const expectedLocation = `${baseUrl}${path}`;
    if (response.headers.get("location") !== expectedLocation) fail(`legacy ${path} redirects to ${response.headers.get("location") ?? "nothing"}, expected ${expectedLocation}`);
  }
}

const appVersion = await checkVersion();
await checkHtml();
const bootstrap = await checkApis();
await checkLegacy();

const recommendedCoverage = bootstrap?.coverage?.find((row) => row.date === bootstrap.recommendedDate)?.coverageRate ?? 0;
const newestRawMarketDate = bootstrap?.dates?.[0] ?? null;
const newestCoverage = bootstrap?.coverage?.find((row) => row.date === newestRawMarketDate)?.coverageRate ?? 0;
const health = {
  appVersion,
  recommendedMarketDate: bootstrap?.recommendedDate ?? null,
  newestRawMarketDate,
  recommendedCoverageRate: recommendedCoverage,
  newestCoverageRate: newestCoverage,
  indexesEnsured
};

console.log(JSON.stringify({ event: "production-smoke", baseUrl, health, durations }, null, 2));
if (newestCoverage < 0.7) console.warn(JSON.stringify({ level: "warn", message: "Newest raw market date coverage is below 0.7", newestRawMarketDate, newestCoverage }));
if (recommendedCoverage < 0.5) fail(`recommended market date coverage ${recommendedCoverage} is below 0.5`);
if (failures.length) {
  console.error(JSON.stringify({ event: "production-smoke-failed", failures }, null, 2));
  process.exitCode = 1;
}
