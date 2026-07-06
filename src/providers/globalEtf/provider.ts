import { findGlobalEtfConfig } from "../../config/globalEtfs.js";
import type { GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import { defaultCrawlerHeaders, fetchSource, type SourceFetchResult } from "../../services/source/httpClient.js";
import { buildGlobalSnapshot } from "./normalizer.js";
import {
  parseBlackRockBaiSpreadsheet,
  parseCorgiEuvRows,
  parseRoundhillDramCsv,
  parseSec13fInformationTable,
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

async function fetchTemaHoldings(etfCode: string) {
  const etf = findGlobalEtfConfig(etfCode);
  if (!etf?.holdingsUrl) throw new Error(`${etfCode} holdings URL missing`);
  const raw = await fetchSource({ url: etf.holdingsUrl, headers: defaultCrawlerHeaders(etf.sourceUrl) });
  if (raw.responseStatus < 200 || raw.responseStatus >= 300) throw new Error(`${etfCode} holdings returned ${raw.responseStatus}`);
  const parsed = parseTemaNasaCsv(raw.rawBody, etf, raw.url);
  return { snapshot: buildGlobalSnapshot(etf, { ...parsed, sourceUrl: raw.url }), raw };
}

async function fetchBlackRockHoldings(etfCode: string) {
  const etf = findGlobalEtfConfig(etfCode);
  if (!etf?.holdingsUrl) throw new Error(`${etfCode} holdings URL missing`);
  const raw = await fetchSource({
    url: etf.holdingsUrl,
    headers: {
      ...defaultCrawlerHeaders(etf.sourceUrl),
      Accept: "application/vnd.ms-excel,application/xml,text/xml,*/*"
    }
  });
  if (raw.responseStatus < 200 || raw.responseStatus >= 300) throw new Error(`${etfCode} holdings returned ${raw.responseStatus}`);
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

function secHeaders(): Record<string, string> {
  return {
    "User-Agent": process.env.SEC_USER_AGENT ?? "active-etf-monitor contact@example.com",
    Accept: "application/json,application/xml,text/xml,*/*"
  };
}

async function fetchSec13fHoldings(etfCode: string) {
  const etf = findGlobalEtfConfig(etfCode);
  if (!etf?.secCik) throw new Error(`${etfCode} SEC CIK missing`);
  const cik = etf.secCik.padStart(10, "0");
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const submissions = await fetchSource({ url: submissionsUrl, headers: secHeaders(), timeoutMs: 45000 });
  if (submissions.responseStatus < 200 || submissions.responseStatus >= 300) {
    throw new Error(`${etfCode} SEC submissions returned ${submissions.responseStatus}`);
  }

  const body = JSON.parse(submissions.rawBody) as {
    filings?: {
      recent?: {
        form?: string[];
        filingDate?: string[];
        accessionNumber?: string[];
      };
    };
  };
  const recent = body.filings?.recent;
  const index = recent?.form?.findIndex((form) => form === "13F-HR" || form === "13F-HR/A") ?? -1;
  const accessionNumber = index >= 0 ? recent?.accessionNumber?.[index] : undefined;
  const filingDate = index >= 0 ? recent?.filingDate?.[index] : undefined;
  if (!accessionNumber || !filingDate) throw new Error(`${etfCode} latest 13F filing not found`);

  const archiveCik = String(Number(cik));
  const archiveBase = `https://www.sec.gov/Archives/edgar/data/${archiveCik}/${accessionNumber.replace(/-/gu, "")}/`;
  const indexUrl = `${archiveBase}index.json`;
  const filingIndex = await fetchSource({ url: indexUrl, headers: secHeaders(), timeoutMs: 45000 });
  if (filingIndex.responseStatus < 200 || filingIndex.responseStatus >= 300) {
    throw new Error(`${etfCode} SEC filing index returned ${filingIndex.responseStatus}`);
  }
  const indexBody = JSON.parse(filingIndex.rawBody) as {
    directory?: {
      item?: Array<{ name?: string; size?: string }>;
    };
  };
  const informationTable = indexBody.directory?.item
    ?.map((item) => item.name)
    .find((name): name is string => Boolean(name && /\.xml$/iu.test(name) && name !== "primary_doc.xml"));
  if (!informationTable) throw new Error(`${etfCode} SEC 13F information table not found`);

  const tableUrl = `${archiveBase}${informationTable}`;
  const raw = await fetchSource({ url: tableUrl, headers: secHeaders(), timeoutMs: 45000 });
  if (raw.responseStatus < 200 || raw.responseStatus >= 300) {
    throw new Error(`${etfCode} SEC 13F table returned ${raw.responseStatus}`);
  }

  const parsed = parseSec13fInformationTable(raw.rawBody, etf, raw.url, filingDate);
  return { snapshot: buildGlobalSnapshot(etf, { ...parsed, sourceUrl: raw.url }), raw: [submissions, filingIndex, raw] };
}

export async function fetchGlobalEtfSnapshot(etfCode: string): Promise<GlobalEtfFetchOutput> {
  const normalized = etfCode.trim().toUpperCase();

  if (normalized === "DRAM") return fetchRoundhillDram();
  const etf = findGlobalEtfConfig(normalized);
  if (etf?.providerId === "tema") return fetchTemaHoldings(normalized);
  if (etf?.providerId === "blackrock") return fetchBlackRockHoldings(normalized);
  if (etf?.providerId === "sec13f") return fetchSec13fHoldings(normalized);
  if (normalized === "EUV") return fetchCorgiEuv();

  throw new Error(`${normalized} is not enabled for Global ETF sync`);
}
