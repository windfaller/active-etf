import { findGlobalEtfConfig } from "../../config/globalEtfs.js";
import type { GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import { defaultCrawlerHeaders, fetchSource, type SourceFetchResult } from "../../services/source/httpClient.js";
import { buildGlobalSnapshot } from "./normalizer.js";
import {
  parseBlackRockBaiSpreadsheet,
  parseCorgiEuvRows,
  parseRoundhillDramCsv,
  parseTemaNasaCsv
} from "./parser.js";

export interface GlobalEtfFetchOutput {
  snapshot: GlobalEtfSnapshot;
  raw: SourceFetchResult | SourceFetchResult[];
}

function mmddyyyy(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}${day}${date.getUTCFullYear()}`;
}

async function fetchRoundhillDram() {
  const etf = findGlobalEtfConfig("DRAM");
  if (!etf) throw new Error("DRAM config missing");
  const today = new Date();
  const attempts = Array.from({ length: 15 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - index));
    return `https://www.roundhillinvestments.com/assets/data/filepointroundhill.40ru.ru_holdings_${mmddyyyy(date)}.csv`;
  });

  const errors: string[] = [];
  for (const url of attempts) {
    const raw = await fetchSource({ url, headers: defaultCrawlerHeaders(etf.sourceUrl) });
    if (raw.responseStatus >= 200 && raw.responseStatus < 300 && raw.rawBody.includes("StockTicker")) {
      const parsed = parseRoundhillDramCsv(raw.rawBody, etf, raw.url);
      return { snapshot: buildGlobalSnapshot(etf, { ...parsed, sourceUrl: raw.url }), raw };
    }
    errors.push(`${url} -> ${raw.responseStatus}`);
  }

  throw new Error(`DRAM holdings CSV not found in recent 15 calendar days: ${errors.slice(0, 3).join("; ")}`);
}

async function fetchTemaNasa() {
  const etf = findGlobalEtfConfig("NASA");
  if (!etf?.holdingsUrl) throw new Error("NASA holdings URL missing");
  const raw = await fetchSource({ url: etf.holdingsUrl, headers: defaultCrawlerHeaders(etf.sourceUrl) });
  if (raw.responseStatus < 200 || raw.responseStatus >= 300) throw new Error(`NASA holdings returned ${raw.responseStatus}`);
  const parsed = parseTemaNasaCsv(raw.rawBody, etf, raw.url);
  return { snapshot: buildGlobalSnapshot(etf, { ...parsed, sourceUrl: raw.url }), raw };
}

async function fetchBlackRockBai() {
  const etf = findGlobalEtfConfig("BAI");
  if (!etf?.holdingsUrl) throw new Error("BAI holdings URL missing");
  const raw = await fetchSource({
    url: etf.holdingsUrl,
    headers: {
      ...defaultCrawlerHeaders(etf.sourceUrl),
      Accept: "application/vnd.ms-excel,application/xml,text/xml,*/*"
    }
  });
  if (raw.responseStatus < 200 || raw.responseStatus >= 300) throw new Error(`BAI holdings returned ${raw.responseStatus}`);
  const parsed = parseBlackRockBaiSpreadsheet(raw.rawBody, etf, raw.url);
  return { snapshot: buildGlobalSnapshot(etf, { ...parsed, sourceUrl: raw.url }), raw };
}

async function fetchCorgiEuv() {
  const etf = findGlobalEtfConfig("EUV");
  if (!etf?.holdingsUrl) throw new Error("EUV holdings URL missing");

  const allRows: unknown[] = [];
  const rawPages: SourceFetchResult[] = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = `${etf.holdingsUrl}${etf.holdingsUrl.includes("?") ? "&" : "?"}offset=${offset}`;
    const raw = await fetchSource({ url, headers: defaultCrawlerHeaders(etf.sourceUrl), timeoutMs: 45000 });
    rawPages.push(raw);
    if (raw.responseStatus < 200 || raw.responseStatus >= 300) throw new Error(`EUV holdings returned ${raw.responseStatus}`);

    const body = JSON.parse(raw.rawBody) as {
      data?: unknown[];
      holdings?: unknown[];
      pagination?: { has_more?: boolean; limit?: number; offset?: number };
    };
    const rows = body.data ?? body.holdings ?? [];
    allRows.push(...rows);
    hasMore = Boolean(body.pagination?.has_more);
    offset += body.pagination?.limit ?? limit;
  }

  const parsed = parseCorgiEuvRows(allRows, etf, rawPages[0]?.url ?? etf.holdingsUrl);
  return { snapshot: buildGlobalSnapshot(etf, { ...parsed, sourceUrl: rawPages[0]?.url ?? etf.holdingsUrl }), raw: rawPages };
}

export async function fetchGlobalEtfSnapshot(etfCode: string): Promise<GlobalEtfFetchOutput> {
  const normalized = etfCode.trim().toUpperCase();

  if (normalized === "DRAM") return fetchRoundhillDram();
  if (normalized === "NASA") return fetchTemaNasa();
  if (normalized === "BAI") return fetchBlackRockBai();
  if (normalized === "EUV") return fetchCorgiEuv();

  throw new Error(`${normalized} is not enabled for Global ETF sync`);
}
