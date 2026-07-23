interface MarketImpact {
  stockId?: string;
  stockName?: string;
  totalActiveDiffLots?: number;
  totalDiffWeightPoint?: number;
}

interface MarketSnapshot {
  dates?: string[];
  selectedDate?: string | null;
  recommendedDate?: string | null;
  coverage?: Array<{
    date?: string;
    availableCount?: number;
    trackedCount?: number;
  }>;
  dashboard?: {
    coverage?: {
      availableCount?: number;
      trackedCount?: number;
      etfs?: Array<{
        etfCode?: string;
        latestTradeDate?: string;
      }>;
    };
    stockImpact?: {
      impacts?: MarketImpact[];
    };
  } | null;
}

interface SignalStock {
  symbol?: string;
  name?: string;
  path?: string;
}

interface ConsecutiveSignal {
  stock?: SignalStock;
  direction?: string;
  consecutiveTradingDays?: number;
}

interface ReversalSignal {
  stock?: SignalStock;
  reversalType?: string;
  reversalDate?: string;
}

interface DivergenceSignal {
  stock?: SignalStock;
  etfDirection?: string;
  date?: string;
}

interface SignalsSnapshot {
  sourceAsOf?: string | null;
  coverage?: {
    availableCount?: number;
    trackedCount?: number;
  };
  consecutive?: ConsecutiveSignal[];
  reversals?: ReversalSignal[];
  divergences?: DivergenceSignal[];
}

interface StockSnapshot {
  sourceAsOf?: string | null;
  stock?: {
    symbol?: string;
    name?: string;
  };
  summary?: {
    coveredEtfs?: number;
  };
}

interface GlobalStatusRow {
  etfCode?: string;
  sourceAsOf?: string;
  rowCount?: number;
  sourceStatus?: string;
}

interface GlobalSnapshot {
  reportDate?: string | null;
  successCount?: number;
  totalCount?: number;
  statusRows?: GlobalStatusRow[];
}

export interface PrerenderSnapshot {
  market?: MarketSnapshot;
  signals?: SignalsSnapshot;
  twStock?: StockSnapshot;
  usStock?: StockSnapshot;
  global?: GlobalSnapshot;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#039;");
}

function validDate(value: unknown): string | undefined {
  return typeof value === "string" && isoDatePattern.test(value) ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatNumber(value: number | undefined, digits = 0): string {
  return value === undefined ? "—" : new Intl.NumberFormat("zh-TW", { maximumFractionDigits: digits }).format(value);
}

function stockLink(stock: SignalStock | undefined): string {
  if (!stock?.path || !stock.symbol) return "";
  const label = `${stock.symbol}${stock.name ? ` ${stock.name}` : ""}`;
  return `<a href="${escapeHtml(stock.path)}">${escapeHtml(label)}</a>`;
}

async function fetchJson<T>(baseUrl: string, path: string): Promise<T | undefined> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4_000)
    });
    if (!response.ok) return undefined;
    return await response.json() as T;
  } catch {
    return undefined;
  }
}

export async function loadPrerenderSnapshot(
  baseUrl = process.env.SEO_DATA_BASE_URL ?? "https://active-etf.inthewins.com"
): Promise<PrerenderSnapshot> {
  if (process.env.SEO_DATA_FETCH === "0") return {};
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  const [market, signals, twStock, usStock, global] = await Promise.all([
    fetchJson<MarketSnapshot>(normalizedBaseUrl, "/api/market/bootstrap?limit=30"),
    fetchJson<SignalsSnapshot>(normalizedBaseUrl, "/api/signals?window=5&limit=12"),
    fetchJson<StockSnapshot>(normalizedBaseUrl, "/api/stocks/tw/2330/overview"),
    fetchJson<StockSnapshot>(normalizedBaseUrl, "/api/stocks/us/MU/overview"),
    fetchJson<GlobalSnapshot>(normalizedBaseUrl, "/api/global-etfs/daily-report?format=web")
  ]);
  return { market, signals, twStock, usStock, global };
}

function globalStatusForPath(snapshot: PrerenderSnapshot, path: string): GlobalStatusRow | undefined {
  const code = path.match(/^\/(?:global-etfs|institutions)\/([^/]+)$/u)?.[1];
  return code ? snapshot.global?.statusRows?.find((row) => row.etfCode === code) : undefined;
}

export function prerenderDateForPath(snapshot: PrerenderSnapshot, path: string): string | undefined {
  const taiwanEtfCode = path.match(/^\/etf\/([^/]+)/u)?.[1];
  if (taiwanEtfCode) {
    const etfDate = snapshot.market?.dashboard?.coverage?.etfs?.find((row) => row.etfCode === taiwanEtfCode)?.latestTradeDate;
    return validDate(etfDate);
  }
  if (path === "/" || path === "/market") {
    return validDate(snapshot.market?.dates?.[0] ?? snapshot.market?.coverage?.[0]?.date);
  }
  if (path.startsWith("/signals")) return validDate(snapshot.signals?.sourceAsOf);
  if (path === "/stocks/tw/2330") return validDate(snapshot.twStock?.sourceAsOf);
  if (path === "/stocks/us/MU") return validDate(snapshot.usStock?.sourceAsOf);
  const globalStatus = globalStatusForPath(snapshot, path);
  if (globalStatus) return validDate(globalStatus.sourceAsOf);
  if (path === "/global-etfs" || path === "/institutions") return validDate(snapshot.global?.reportDate);
  return undefined;
}

function marketContent(snapshot: PrerenderSnapshot): string {
  const market = snapshot.market;
  const impacts = market?.dashboard?.stockImpact?.impacts?.slice(0, 6) ?? [];
  const selectedDate = validDate(market?.selectedDate);
  if (!market || !selectedDate || !impacts.length) return "";
  const coverage = market.dashboard?.coverage;
  const newestCoverage = market.coverage?.find((row) => validDate(row.date));
  const newestDisclosure = newestCoverage && newestCoverage.date !== selectedDate
    ? `最新揭露日 ${newestCoverage.date} 目前為 ${formatNumber(finiteNumber(newestCoverage.availableCount))}／${formatNumber(finiteNumber(newestCoverage.trackedCount))} 檔；`
    : "";
  const rows = impacts.map((row) => {
    const symbol = row.stockId?.trim();
    if (!symbol) return "";
    const label = `${symbol}${row.stockName ? ` ${row.stockName}` : ""}`;
    const lots = formatNumber(finiteNumber(row.totalActiveDiffLots), 0);
    const weight = formatNumber(finiteNumber(row.totalDiffWeightPoint), 2);
    return `<li><a href="/stocks/tw/${escapeHtml(symbol)}">${escapeHtml(label)}</a><span>主動淨變動 ${lots} 張；權重差 ${weight} pp</span></li>`;
  }).filter(Boolean).join("");
  if (!rows) return "";
  return [
    '<section class="seo-live-data" aria-labelledby="seo-market-snapshot">',
    `<h2 id="seo-market-snapshot">${selectedDate} 市場資料摘要</h2>`,
    `<p>${newestDisclosure}跨 ETF 比較預設使用 ${selectedDate}，涵蓋 ${formatNumber(finiteNumber(coverage?.availableCount))}／${formatNumber(finiteNumber(coverage?.trackedCount))} 檔追蹤 ETF。以下為該完整度較高資料日的主動淨變動摘要。</p>`,
    `<ul>${rows}</ul>`,
    "</section>"
  ].join("");
}

function signalsContent(snapshot: PrerenderSnapshot, path: string): string {
  const signals = snapshot.signals;
  const sourceAsOf = validDate(signals?.sourceAsOf);
  if (!signals || !sourceAsOf) return "";
  const requested = path === "/signals/consecutive"
    ? (signals.consecutive ?? []).slice(0, 6).map((row) => ({
        stock: row.stock,
        detail: `${row.direction === "increase" ? "連續加碼" : "連續減碼"} ${formatNumber(finiteNumber(row.consecutiveTradingDays))} 日`
      }))
    : path === "/signals/reversals"
      ? (signals.reversals ?? []).slice(0, 6).map((row) => ({ stock: row.stock, detail: row.reversalType ?? "方向反轉" }))
      : path === "/signals/divergence"
        ? (signals.divergences ?? []).slice(0, 6).map((row) => ({
            stock: row.stock,
            detail: `ETF ${row.etfDirection === "increase" ? "加碼" : "減碼"}與法人方向分歧`
          }))
        : [
            ...(signals.consecutive ?? []).slice(0, 3).map((row) => ({
              stock: row.stock,
              detail: `${row.direction === "increase" ? "連續加碼" : "連續減碼"} ${formatNumber(finiteNumber(row.consecutiveTradingDays))} 日`
            })),
            ...(signals.reversals ?? []).slice(0, 2).map((row) => ({ stock: row.stock, detail: row.reversalType ?? "方向反轉" })),
            ...(signals.divergences ?? []).slice(0, 2).map((row) => ({ stock: row.stock, detail: "ETF 與法人方向分歧" }))
          ];
  const rows = requested
    .filter((row) => row.stock?.path && row.stock.symbol)
    .map((row) => `<li>${stockLink(row.stock)}<span>${escapeHtml(row.detail)}</span></li>`)
    .join("");
  if (!rows) return "";
  return [
    '<section class="seo-live-data" aria-labelledby="seo-signal-snapshot">',
    `<h2 id="seo-signal-snapshot">${sourceAsOf} 訊號摘要</h2>`,
    `<p>資料涵蓋 ${formatNumber(finiteNumber(signals.coverage?.availableCount))}／${formatNumber(finiteNumber(signals.coverage?.trackedCount))} 檔追蹤 ETF。</p>`,
    `<ul>${rows}</ul>`,
    "</section>"
  ].join("");
}

function stockContent(stock: StockSnapshot | undefined): string {
  const sourceAsOf = validDate(stock?.sourceAsOf);
  if (!stock || !sourceAsOf || !stock.stock?.symbol) return "";
  const label = `${stock.stock.symbol}${stock.stock.name ? ` ${stock.stock.name}` : ""}`;
  return [
    '<section class="seo-live-data" aria-labelledby="seo-stock-snapshot">',
    `<h2 id="seo-stock-snapshot">${escapeHtml(label)} 最新資料摘要</h2>`,
    `<p>資料日 ${sourceAsOf}；目前涵蓋 ${formatNumber(finiteNumber(stock.summary?.coveredEtfs))} 檔 ETF。完整頁面另列不同來源的資料日期與限制。</p>`,
    "</section>"
  ].join("");
}

function globalContent(snapshot: PrerenderSnapshot, path: string): string {
  const report = snapshot.global;
  const status = globalStatusForPath(snapshot, path);
  if (status?.etfCode && validDate(status.sourceAsOf)) {
    return [
      '<section class="seo-live-data" aria-labelledby="seo-global-snapshot">',
      `<h2 id="seo-global-snapshot">${escapeHtml(status.etfCode)} 最新官方資料</h2>`,
      `<p>來源日 ${status.sourceAsOf}；共 ${formatNumber(finiteNumber(status.rowCount))} 筆持倉，來源狀態為 ${status.sourceStatus === "ok" ? "可用" : "待確認"}。</p>`,
      "</section>"
    ].join("");
  }
  const reportDate = validDate(report?.reportDate);
  if (!reportDate || (path !== "/global-etfs" && path !== "/institutions")) return "";
  const rows = (report?.statusRows ?? [])
    .filter((row) => row.etfCode && validDate(row.sourceAsOf))
    .slice(0, 10)
    .map((row) => {
      const family = row.etfCode?.endsWith("13F") ? "institutions" : "global-etfs";
      return `<li><a href="/${family}/${escapeHtml(row.etfCode as string)}">${escapeHtml(row.etfCode as string)}</a><span>來源日 ${row.sourceAsOf}</span></li>`;
    })
    .join("");
  return [
    '<section class="seo-live-data" aria-labelledby="seo-global-snapshot">',
    `<h2 id="seo-global-snapshot">${reportDate} 海外資料狀態</h2>`,
    `<p>官方來源成功 ${formatNumber(finiteNumber(report?.successCount))}／${formatNumber(finiteNumber(report?.totalCount))} 檔；各 ETF 與 13F 仍以自己的來源日為準。</p>`,
    rows ? `<ul>${rows}</ul>` : "",
    "</section>"
  ].join("");
}

export function prerenderContentForPath(snapshot: PrerenderSnapshot, path: string): string {
  if (path === "/" || path === "/market") return marketContent(snapshot);
  if (path.startsWith("/signals")) return signalsContent(snapshot, path);
  if (path === "/stocks/tw/2330") return stockContent(snapshot.twStock);
  if (path === "/stocks/us/MU") return stockContent(snapshot.usStock);
  if (path === "/global-etfs" || path === "/institutions" || /^\/(?:global-etfs|institutions)\/[^/]+$/u.test(path)) {
    return globalContent(snapshot, path);
  }
  return "";
}
