import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/playwright/source-discovery");
const fundCode = process.argv[2] ?? "49YTW";
const urls = [
  `https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=${fundCode}`,
  `https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=${fundCode}`,
  `https://www.ezmoney.com.tw/ETF/Transaction/UnitMarketRatio?fundCode=${fundCode}`
];

const interestingTypes = new Set(["document", "xhr", "fetch", "script"]);
const interestingContentType = /(json|text|html|csv|xml|excel|spreadsheet|octet-stream)/iu;

function safeName(input) {
  return input.replace(/[^a-z0-9._-]+/giu, "_").slice(0, 180);
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

async function captureBody(response) {
  const request = response.request();
  const resourceType = request.resourceType();
  const headers = response.headers();
  const contentType = headers["content-type"] ?? "";

  if (!interestingTypes.has(resourceType) && !interestingContentType.test(contentType)) {
    return null;
  }

  try {
    const body = await response.body();
    if (body.length > 2_000_000) {
      return {
        skipped: true,
        reason: `Body too large: ${body.length} bytes`
      };
    }

    const text = body.toString("utf8");
    const ext = contentType.includes("json")
      ? "json"
      : contentType.includes("csv")
        ? "csv"
        : contentType.includes("html")
          ? "html"
          : "txt";
    const filename = `${safeName(resourceType)}-${response.status()}-${sha256(response.url())}.${ext}`;
    await writeFile(path.join(outputDir, filename), text);

    return {
      filename,
      byteLength: body.length,
      preview: text.slice(0, 500)
    };
  } catch (error) {
    return {
      skipped: true,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true
});

const context = await browser.newContext({
  locale: "zh-TW",
  timezoneId: "Asia/Taipei",
  userAgent:
    process.env.CRAWLER_USER_AGENT ??
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
  extraHTTPHeaders: {
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache"
  }
});

const page = await context.newPage();
const captures = [];
const failedRequests = [];

page.on("requestfailed", (request) => {
  failedRequests.push({
    url: request.url(),
    method: request.method(),
    resourceType: request.resourceType(),
    failure: request.failure()?.errorText ?? "unknown"
  });
});

page.on("response", (response) => {
  const request = response.request();
  const record = {
    pageUrl: page.url(),
    url: response.url(),
    method: request.method(),
    resourceType: request.resourceType(),
    status: response.status(),
    requestHeaders: request.headers(),
    responseHeaders: response.headers(),
    postData: request.postData()
  };

  captures.push(
    captureBody(response).then((body) => ({
      ...record,
      body
    }))
  );
});

const pageResults = [];

for (const url of urls) {
  const startedAt = new Date().toISOString();
  let result;
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(5_000);
    result = {
      url,
      startedAt,
      finalUrl: page.url(),
      title: await page.title().catch(() => ""),
      status: response?.status() ?? null,
      ok: response?.ok() ?? false,
      textSample: (await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")).slice(0, 1000)
    };
    await page.screenshot({
      path: path.join(outputDir, `${safeName(new URL(url).pathname)}-${fundCode}.png`),
      fullPage: true
    });
  } catch (error) {
    result = {
      url,
      startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  pageResults.push(result);
}

const settledCaptures = await Promise.all(captures);
const summary = {
  fundCode,
  generatedAt: new Date().toISOString(),
  pageResults,
  failedRequests,
  responses: settledCaptures
    .filter((item) => item.status >= 300 || interestingTypes.has(item.resourceType) || item.body)
    .sort((a, b) => a.url.localeCompare(b.url))
};

await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
await browser.close();

console.log(JSON.stringify({
  outputDir,
  pages: pageResults.length,
  responses: summary.responses.length,
  failedRequests: failedRequests.length
}, null, 2));
