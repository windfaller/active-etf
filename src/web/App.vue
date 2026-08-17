<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowLeft, Calendar, Globe2, Home, Layers, ListChecks, Moon, RefreshCw, Search, Sun, Trophy } from "@lucide/vue";
import { configuredEtfs } from "../config/etfs";
import { enabledGlobalEtfs } from "../config/globalEtfs";
import type { DashboardResponse, EtfCoverageResponse } from "./contracts/dashboard";
import { emptyChanges } from "./contracts/dashboard";
import type { GlobalEtfOption, GlobalEtfUniverseResponse, GlobalReport } from "./contracts/global";
import type { AppRoute } from "./contracts/navigation";
import { useColorMode } from "./composables/useColorMode";
import { getJson } from "./apiClient";
import { notFoundMetadata, routeMetadataForPath, routeStructuredData, SITE_ORIGIN } from "./seo/routeMetadata";

type RouteComponentLoader = () => Promise<unknown>;

const loadForvixMarketEmbed = () => import("./components/ForvixMarketEmbed.vue");
const loadGlobalSearchDialog = () => import("./components/search/GlobalSearchDialog.vue");
const loadDailyBriefView = () => import("./views/DailyBriefView.vue");
const loadTaiwanMarketView = () => import("./views/TaiwanMarketView.vue");
const loadTaiwanEtfView = () => import("./views/TaiwanEtfView.vue");
const loadGlobalMarketView = () => import("./views/GlobalMarketView.vue");
const loadGlobalEtfView = () => import("./views/GlobalEtfView.vue");
const loadInstitutionView = () => import("./views/InstitutionView.vue");
const loadStocksIndexView = () => import("./views/StocksIndexView.vue");
const loadStockDetailView = () => import("./views/StockDetailView.vue");
const loadEtfCompareView = () => import("./views/EtfCompareView.vue");
const loadFundPerformanceView = () => import("./views/FundPerformanceView.vue");
const loadSignalsView = () => import("./views/SignalsView.vue");
const loadEtfStyleView = () => import("./views/EtfStyleView.vue");
const loadSearchResultsView = () => import("./views/SearchResultsView.vue");
const loadMethodologyView = () => import("./views/MethodologyView.vue");
const loadNotFoundView = () => import("./views/NotFoundView.vue");

const ForvixMarketEmbed = defineAsyncComponent(loadForvixMarketEmbed);
const GlobalSearchDialog = defineAsyncComponent(loadGlobalSearchDialog);
const DailyBriefView = defineAsyncComponent(loadDailyBriefView);
const TaiwanMarketView = defineAsyncComponent(loadTaiwanMarketView);
const TaiwanEtfView = defineAsyncComponent(loadTaiwanEtfView);
const GlobalMarketView = defineAsyncComponent(loadGlobalMarketView);
const GlobalEtfView = defineAsyncComponent(loadGlobalEtfView);
const InstitutionView = defineAsyncComponent(loadInstitutionView);
const StocksIndexView = defineAsyncComponent(loadStocksIndexView);
const StockDetailView = defineAsyncComponent(loadStockDetailView);
const EtfCompareView = defineAsyncComponent(loadEtfCompareView);
const FundPerformanceView = defineAsyncComponent(loadFundPerformanceView);
const SignalsView = defineAsyncComponent(loadSignalsView);
const EtfStyleView = defineAsyncComponent(loadEtfStyleView);
const SearchResultsView = defineAsyncComponent(loadSearchResultsView);
const MethodologyView = defineAsyncComponent(loadMethodologyView);
const NotFoundView = defineAsyncComponent(loadNotFoundView);

const prefetchedRouteLoaders = new Set<RouteComponentLoader>();

function routeComponentLoader(pathname: string): RouteComponentLoader | null {
  const path = cleanPath(new URL(pathname, window.location.origin).pathname);
  if (path === "/") return loadDailyBriefView;
  if (path === "/market") return loadTaiwanMarketView;
  if (path === "/global-etfs") return loadGlobalMarketView;
  if (/^\/global-etfs\/[^/]+$/u.test(path)) return loadGlobalEtfView;
  if (path === "/institutions" || /^\/institutions\/[^/]+$/u.test(path)) return loadInstitutionView;
  if (path === "/stocks") return loadStocksIndexView;
  if (/^\/stocks\/(?:tw|us)\/[^/]+$/u.test(path)) return loadStockDetailView;
  if (path === "/compare/etfs") return loadEtfCompareView;
  if (path === "/performance") return loadFundPerformanceView;
  if (path === "/signals" || path.startsWith("/signals/")) return loadSignalsView;
  if (/^\/etf\/[^/]+\/style$/u.test(path)) return loadEtfStyleView;
  if (/^\/etf\/[^/]+(?:\/(?:changes|premium-history))?$/u.test(path)) return loadTaiwanEtfView;
  if (path === "/search") return loadSearchResultsView;
  if (path === "/methodology") return loadMethodologyView;
  return null;
}

function prefetchRouteComponent(path: string): void {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return;
  const loader = routeComponentLoader(path);
  if (!loader || prefetchedRouteLoaders.has(loader)) return;
  prefetchedRouteLoaders.add(loader);
  void loader().catch(() => prefetchedRouteLoaders.delete(loader));
}

interface TelegramInfo { configured: boolean; username: string | null; subscribeUrl: string | null }
interface MarketDateCoverage { date: string; availableCount: number; trackedCount: number; coverageRate: number }
interface MarketDatesResponse { dates: string[]; recommendedDate?: string | null; coverage?: MarketDateCoverage[] }
interface MarketDashboardResponse {
  date: string;
  stockImpact: DashboardResponse["stockImpact"];
  coverage: DashboardResponse["coverage"];
}
interface MarketBootstrapResponse extends MarketDatesResponse {
  selectedDate: string | null;
  dashboard: MarketDashboardResponse | null;
}

const etfOptions = configuredEtfs.filter((etf) => etf.enabled).map((etf) => ({
  etfCode: etf.etfCode,
  name: etf.name,
  issuer: etf.issuer,
  source: { infoUrl: etf.source.infoUrl }
}));
const configuredGlobalOptions: GlobalEtfOption[] = enabledGlobalEtfs.map((etf) => ({ etfCode: etf.etfCode, fundName: etf.fundName, strategyType: etf.strategyType }));
const knownTaiwanCodes = new Set(etfOptions.map((etf) => etf.etfCode));
const knownGlobalCodes = new Set(enabledGlobalEtfs.filter((etf) => etf.strategyType !== "13f").map((etf) => etf.etfCode));
const knownInstitutionCodes = new Set(enabledGlobalEtfs.filter((etf) => etf.strategyType === "13f").map((etf) => etf.etfCode));

const route = ref<AppRoute>({ view: "daily", path: "/" });
const selectedEtfCode = ref(etfOptions[0]?.etfCode ?? "00981A");
const marketDate = ref("");
const marketAvailableDates = ref<string[]>([]);
const marketDateCoverage = ref<MarketDateCoverage[]>([]);
const selectedEtfDate = ref("");
const selectedEtfAvailableDates = ref<string[]>([]);
const emptyDashboard = (): DashboardResponse => ({
  holdings: [], summary: null, changes: emptyChanges, summaries: [],
  stockImpact: { impacts: [], sectorSummary: { sectors: [] } },
  coverage: { date: null, trackedCount: 0, availableCount: 0, staleCount: 0, etfs: [] }
});
const marketDashboard = ref<DashboardResponse>(emptyDashboard());
const selectedEtfDashboard = ref<DashboardResponse>(emptyDashboard());
const isTaiwanLoading = ref(false);
const taiwanError = ref("");
const focusStockId = ref("");

const globalOptions = ref<GlobalEtfOption[]>(configuredGlobalOptions);
const selectedGlobalCode = ref(enabledGlobalEtfs.find((etf) => etf.strategyType !== "13f")?.etfCode ?? "DRAM");
const selectedInstitutionCode = ref(enabledGlobalEtfs.find((etf) => etf.strategyType === "13f")?.etfCode ?? "");
const selectedGlobalDate = ref("");
const globalAvailableDates = ref<string[]>([]);
const globalReport = ref<GlobalReport | null>(null);
const isGlobalLoading = ref(false);
const globalError = ref("");

const telegramInfo = ref<TelegramInfo | null>(null);
const isMobileSearchOpen = ref(false);
const p1RefreshKey = ref(0);
const { isDarkMode, toggleColorMode } = useColorMode();
const marketDateCoverageThreshold = 0.7;
const initialMarketDateLimit = 60;

const dashboard = computed(() => route.value.view === "taiwanEtf" ? selectedEtfDashboard.value : marketDashboard.value);
const selectedEtfCoverage = computed(() => selectedEtfDashboard.value.coverage.etfs.find((etf) => etf.etfCode === selectedEtfCode.value) ?? null);
const globalEtfOptions = computed(() => globalOptions.value.filter((option) => option.strategyType !== "13f"));
const institutionOptions = computed(() => globalOptions.value.filter((option) => option.strategyType === "13f"));
const isTaiwanArea = computed(() => ["daily", "market", "taiwanEtf"].includes(route.value.view));
const isTaiwanMarketArea = computed(() => route.value.view === "daily" || route.value.view === "market");
const isTaiwanEtfArea = computed(() => route.value.view === "taiwanEtf");
const isGlobalArea = computed(() => ["globalMarket", "globalEtf", "institutions", "institution"].includes(route.value.view));
const isP1Area = computed(() => ["stocks", "stock", "compareEtfs", "performance", "signals", "etfStyle", "search", "methodology"].includes(route.value.view));
const shouldShowForvixEmbed = computed(() =>
  ["daily", "market", "taiwanEtf", "globalMarket", "globalEtf", "institutions", "institution"].includes(route.value.view)
);
const telegramUrl = computed(() => telegramInfo.value?.subscribeUrl ?? "https://telegram.org/");
const newerPartialMarketDate = computed(() => {
  const latest = marketDateCoverage.value[0];
  if (!latest || latest.date === marketDate.value || latest.coverageRate >= marketDateCoverageThreshold) return null;
  return latest;
});
const parentNavigation = computed<{ path: string; label: string } | null>(() => {
  if (route.value.view === "taiwanEtf") {
    if ((route.value.etfSection === "changes" || route.value.etfPage === "premiumHistory") && route.value.etfCode) {
      return { path: `/etf/${route.value.etfCode}`, label: `返回 ${route.value.etfCode} 單檔 ETF` };
    }
    return { path: "/market", label: "返回台灣 ETF 市場總覽" };
  }
  if (route.value.view === "globalEtf") return { path: "/global-etfs", label: "返回海外 ETF 市場總覽" };
  if (route.value.view === "institution") return { path: "/institutions", label: "返回機構 13F 清單" };
  if (route.value.view === "institutions") return { path: "/global-etfs", label: "返回海外 ETF" };
  if (route.value.view === "stock") return { path: "/stocks", label: "返回股票情報" };
  if (route.value.view === "etfStyle" && route.value.etfCode) return { path: `/etf/${route.value.etfCode}`, label: `返回 ${route.value.etfCode} 單檔 ETF` };
  return null;
});

function cleanPath(pathname: string): string {
  const path = pathname.replace(/\/+$/u, "");
  return path || "/";
}

function routeFromPath(pathname: string, search = ""): AppRoute {
  const path = cleanPath(pathname);
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(search);
  if (path === "/") return { view: "daily", path };
  if (path === "/market") return { view: "market", path };
  if (path === "/stocks") return { view: "stocks", path };
  if (parts[0] === "stocks" && (parts[1] === "tw" || parts[1] === "us") && parts[2] && !parts[3]) {
    const symbol = parts[1] === "us" ? parts[2].toUpperCase() : parts[2];
    const valid = parts[1] === "tw" ? /^\d{4,6}$/u.test(symbol) : /^[A-Z][A-Z0-9.-]{0,9}$/u.test(symbol);
    return valid ? { view: "stock", path: `/stocks/${parts[1]}/${symbol}`, stockMarket: parts[1], stockSymbol: symbol } : { view: "notFound", path };
  }
  if (path === "/compare/etfs") {
    const type = params.get("type") === "global" ? "global" : "tw";
    const codes = [...new Set((params.get("codes") ?? "").split(",").map((code) => code.trim().toUpperCase()).filter(Boolean))];
    return { view: "compareEtfs", path, compareType: type, compareCodes: codes };
  }
  if (path === "/performance") return { view: "performance", path };
  if (path === "/signals") return { view: "signals", path, signalKind: "all" };
  if (path === "/signals/consecutive") return { view: "signals", path, signalKind: "consecutive" };
  if (path === "/signals/reversals") return { view: "signals", path, signalKind: "reversals" };
  if (path === "/signals/divergence") return { view: "signals", path, signalKind: "divergence" };
  if (path === "/search") return { view: "search", path, searchQuery: params.get("q") ?? "" };
  if (path === "/methodology") return { view: "methodology", path };

  if (parts[0] === "etf" && parts[1]) {
    const code = parts[1].toUpperCase();
    if (!knownTaiwanCodes.has(code)) return { view: "notFound", path };
    if (parts[2] === "style" && !parts[3]) return { view: "etfStyle", path: `/etf/${code}/style`, etfCode: code };
    if (!parts[2]) return { view: "taiwanEtf", path: `/etf/${code}`, etfCode: code, etfPage: "report", etfSection: "overview" };
    if (parts[2] === "changes" && !parts[3]) return { view: "taiwanEtf", path: `/etf/${code}/changes`, etfCode: code, etfPage: "report", etfSection: "changes" };
    if (parts[2] === "premium-history" && !parts[3]) return { view: "taiwanEtf", path: `/etf/${code}/premium-history`, etfCode: code, etfPage: "premiumHistory", etfSection: "overview" };
    return { view: "notFound", path };
  }

  if (path === "/global-etfs") return { view: "globalMarket", path };
  if (parts[0] === "global-etfs" && parts[1] && !parts[2]) {
    const code = parts[1].toUpperCase();
    return knownGlobalCodes.has(code) ? { view: "globalEtf", path: `/global-etfs/${code}`, globalCode: code } : { view: "notFound", path };
  }
  if (path === "/institutions") return { view: "institutions", path };
  if (parts[0] === "institutions" && parts[1] && !parts[2]) {
    const code = parts[1].toUpperCase();
    return knownInstitutionCodes.has(code) ? { view: "institution", path: `/institutions/${code}`, institutionCode: code } : { view: "notFound", path };
  }
  return { view: "notFound", path };
}

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string): void {
  let element = document.querySelector(selector) as HTMLMetaElement | null;
  if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, key); document.head.appendChild(element); }
  element.content = content;
}

function setLink(rel: string, href: string | null): void {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!href) { element?.remove(); return; }
  if (!element) { element = document.createElement("link"); element.rel = rel; document.head.appendChild(element); }
  element.href = href;
  if (rel === "alternate") element.hreflang = "zh-Hant-TW";
}

function updateDocumentMetadata(): void {
  const metadataPath = `${window.location.pathname}${window.location.search}`;
  const metadata = routeMetadataForPath(metadataPath) ?? notFoundMetadata(route.value.path);
  const canonical = metadata.robots.startsWith("noindex") ? null : `${SITE_ORIGIN}${metadata.path}`;
  document.title = metadata.title;
  setMeta('meta[name="description"]', "name", "description", metadata.description);
  setMeta('meta[name="robots"]', "name", "robots", metadata.robots);
  setMeta('meta[property="og:title"]', "property", "og:title", metadata.title);
  setMeta('meta[property="og:description"]', "property", "og:description", metadata.description);
  setMeta('meta[property="og:url"]', "property", "og:url", canonical ?? `${SITE_ORIGIN}/`);
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", metadata.title);
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", metadata.description);
  setLink("canonical", canonical);
  setLink("alternate", canonical);
  const structured = document.querySelector("#route-structured-data");
  if (structured) structured.textContent = JSON.stringify(routeStructuredData(metadata, new Date().toISOString()));
}

let selectedEtfDateAbort: AbortController | null = null;
let dashboardAbort: AbortController | null = null;
let dashboardRequestId = 0;

function applyMarketDashboard(result: MarketDashboardResponse): void {
  marketDashboard.value = {
    ...emptyDashboard(),
    stockImpact: result.stockImpact,
    coverage: result.coverage
  };
}

async function loadMarketBootstrap(): Promise<boolean> {
  const requestId = ++dashboardRequestId;
  dashboardAbort?.abort();
  dashboardAbort = new AbortController();
  isTaiwanLoading.value = true;
  taiwanError.value = "";
  try {
    const bootstrapParams = new URLSearchParams({ limit: String(initialMarketDateLimit) });
    if (marketDate.value) bootstrapParams.set("date", marketDate.value);
    const result = await getJson<MarketBootstrapResponse>(`/api/market/bootstrap?${bootstrapParams.toString()}`, dashboardAbort.signal);
    if (requestId !== dashboardRequestId || !isTaiwanMarketArea.value) return false;
    marketAvailableDates.value = result.dates;
    marketDateCoverage.value = result.coverage ?? [];
    const recommendedDate = result.selectedDate && result.dates.includes(result.selectedDate)
      ? result.selectedDate
      : result.dates[0] ?? "";
    if (!marketDate.value || !result.dates.includes(marketDate.value)) marketDate.value = recommendedDate;
    if (result.dashboard && result.dashboard.date === marketDate.value) applyMarketDashboard(result.dashboard);
    return Boolean(marketDate.value && result.dashboard);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return false;
    taiwanError.value = error instanceof Error ? error.message : "台灣市場資料讀取失敗。";
    return false;
  } finally {
    if (requestId === dashboardRequestId) isTaiwanLoading.value = false;
  }
}

function marketDateLabel(date: string): string {
  const coverage = marketDateCoverage.value.find((row) => row.date === date);
  return coverage ? `${date}（${coverage.availableCount}/${coverage.trackedCount}）` : date;
}

async function showNewerPartialMarketDate(): Promise<void> {
  if (!newerPartialMarketDate.value) return;
  marketDate.value = newerPartialMarketDate.value.date;
  await loadMarketDashboard();
}

async function loadSelectedEtfAvailableDates(code = selectedEtfCode.value): Promise<boolean> {
  selectedEtfDateAbort?.abort();
  selectedEtfDateAbort = new AbortController();
  try {
    const result = await getJson<{ dates: string[] }>(`/api/etf/${code}/dates?limit=180`, selectedEtfDateAbort.signal);
    if (code !== selectedEtfCode.value) return false;
    selectedEtfAvailableDates.value = result.dates;
    if (!selectedEtfDate.value || !result.dates.includes(selectedEtfDate.value)) selectedEtfDate.value = result.dates[0] ?? "";
    return Boolean(selectedEtfDate.value);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return false;
    taiwanError.value = error instanceof Error ? error.message : "單檔 ETF 日期資料讀取失敗。";
    return false;
  }
}

async function fetchDashboard(code: string, date: string, target: "market" | "etf"): Promise<void> {
  const requestId = ++dashboardRequestId;
  dashboardAbort?.abort();
  dashboardAbort = new AbortController();
  isTaiwanLoading.value = true;
  taiwanError.value = "";
  try {
    const result = target === "market"
      ? await getJson<MarketDashboardResponse>(`/api/market/dashboard?date=${encodeURIComponent(date)}`, dashboardAbort.signal)
      : await getJson<DashboardResponse>(`/api/dashboard?etfCode=${encodeURIComponent(code)}&date=${encodeURIComponent(date)}`, dashboardAbort.signal);
    if (requestId !== dashboardRequestId) return;
    if (target === "market" && date === marketDate.value && isTaiwanMarketArea.value) applyMarketDashboard(result as MarketDashboardResponse);
    if (target === "etf" && code === selectedEtfCode.value && date === selectedEtfDate.value && isTaiwanEtfArea.value) selectedEtfDashboard.value = result as DashboardResponse;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) taiwanError.value = error instanceof Error ? error.message : "台灣 ETF 資料讀取失敗。";
  } finally {
    if (requestId === dashboardRequestId) isTaiwanLoading.value = false;
  }
}

async function loadMarketDashboard(forceDates = false): Promise<void> {
  if (forceDates || !marketAvailableDates.value.length || !marketDate.value) {
    await loadMarketBootstrap();
    return;
  }
  await fetchDashboard(selectedEtfCode.value, marketDate.value, "market");
}

async function loadSelectedEtfDashboard(forceDates = false): Promise<void> {
  const code = selectedEtfCode.value;
  if (forceDates || !selectedEtfAvailableDates.value.length || !selectedEtfDate.value) {
    const ready = await loadSelectedEtfAvailableDates(code);
    if (!ready || code !== selectedEtfCode.value) return;
  }
  await fetchDashboard(code, selectedEtfDate.value, "etf");
}

let globalAbort: AbortController | null = null;
let globalReportPromise: Promise<void> | null = null;
let globalRequestId = 0;

async function loadGlobalReport(force = false): Promise<void> {
  if (globalReportPromise && !force) return globalReportPromise;
  if (force) { globalAbort?.abort(); globalReportPromise = null; }
  const requestId = ++globalRequestId;
  globalAbort = new AbortController();
  const signal = globalAbort.signal;
  isGlobalLoading.value = true;
  globalError.value = "";
  globalReportPromise = (async () => {
    try {
      const [universeResult, datesResult] = await Promise.allSettled([
        getJson<GlobalEtfUniverseResponse>("/api/global-etfs/enabled", signal),
        getJson<{ dates: string[] }>("/api/global-etfs/dates?limit=180", signal)
      ]);
      if (requestId !== globalRequestId) return;
      if (universeResult.status === "fulfilled") globalOptions.value = universeResult.value.enabled;
      if (datesResult.status === "fulfilled") {
        globalAvailableDates.value = datesResult.value.dates;
        if (!selectedGlobalDate.value || !datesResult.value.dates.includes(selectedGlobalDate.value)) selectedGlobalDate.value = datesResult.value.dates[0] ?? "";
      }
      const reportParams = new URLSearchParams({ format: "web" });
      if (selectedGlobalDate.value) reportParams.set("date", selectedGlobalDate.value);
      const report = await getJson<GlobalReport>(`/api/global-etfs/daily-report?${reportParams.toString()}`, signal);
      if (requestId === globalRequestId) globalReport.value = report;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) globalError.value = error instanceof Error ? error.message : "海外 ETF 資料讀取失敗。";
    } finally {
      if (requestId === globalRequestId) isGlobalLoading.value = false;
      globalReportPromise = null;
    }
  })();
  return globalReportPromise;
}

async function loadTelegramInfo(): Promise<void> {
  try { telegramInfo.value = await getJson<TelegramInfo>("/api/telegram/info"); }
  catch { telegramInfo.value = { configured: false, username: null, subscribeUrl: null }; }
}

async function loadForCurrentRoute(): Promise<void> {
  if (isTaiwanMarketArea.value) await loadMarketDashboard();
  else if (isTaiwanEtfArea.value) await loadSelectedEtfDashboard();
  else if (isGlobalArea.value) await loadGlobalReport();
}

function applyRouteFromLocation(): void {
  route.value = routeFromPath(window.location.pathname, window.location.search);
  if (route.value.etfCode) selectedEtfCode.value = route.value.etfCode;
  if (route.value.globalCode) selectedGlobalCode.value = route.value.globalCode;
  if (route.value.institutionCode) selectedInstitutionCode.value = route.value.institutionCode;
  updateDocumentMetadata();
}

async function navigate(path: string, replace = false): Promise<void> {
  const url = new URL(path, window.location.origin);
  const next = cleanPath(url.pathname);
  const nextLocation = `${next}${url.search}`;
  const currentLocation = `${cleanPath(window.location.pathname)}${window.location.search}`;
  if (currentLocation !== nextLocation) window.history[replace ? "replaceState" : "pushState"]({}, "", nextLocation);
  applyRouteFromLocation();
  isMobileSearchOpen.value = false;
  await loadForCurrentRoute();
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function selectTaiwanEtf(code: string): Promise<void> {
  selectedEtfCode.value = code;
  selectedEtfAvailableDates.value = [];
  selectedEtfDate.value = "";
  await navigate(`/etf/${code}`);
}

async function selectGlobalEtf(code: string): Promise<void> { selectedGlobalCode.value = code; await navigate(`/global-etfs/${code}`); }
async function selectInstitution(code: string): Promise<void> { selectedInstitutionCode.value = code; await navigate(`/institutions/${code}`); }

async function showMarketStock(stockId: string): Promise<void> {
  focusStockId.value = stockId;
  if (route.value.view !== "market") await navigate("/market");
  await nextTick();
  document.getElementById(`market-stock-${stockId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
}

async function refreshCurrent(): Promise<void> {
  if (isGlobalArea.value) await loadGlobalReport(true);
  else if (isTaiwanMarketArea.value) await loadMarketDashboard(true);
  else if (isTaiwanEtfArea.value) await loadSelectedEtfDashboard(true);
  else if (isP1Area.value) p1RefreshKey.value += 1;
}

function updateSearchQuery(value: string): void {
  if (route.value.view !== "search") return;
  const next = value.trim() ? `/search?q=${encodeURIComponent(value)}` : "/search";
  window.history.replaceState({}, "", next);
  route.value = { ...route.value, searchQuery: value };
  updateDocumentMetadata();
}

function onGlobalShortcut(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    isMobileSearchOpen.value = true;
  }
}

function onPopState(): void { applyRouteFromLocation(); void loadForCurrentRoute(); }

function scheduleLowPriorityLoads(): void {
  const prefetch = () => {
    void loadTelegramInfo();
    for (const path of ["/performance", "/signals", "/compare/etfs", "/stocks"]) prefetchRouteComponent(path);
  };
  const afterLoad = () => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(prefetch, { timeout: 4000 });
    else window.setTimeout(prefetch, 1500);
  };
  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });
}

onMounted(() => {
  applyRouteFromLocation();
  window.addEventListener("popstate", onPopState);
  window.addEventListener("keydown", onGlobalShortcut);
  void loadForCurrentRoute().then(scheduleLowPriorityLoads, scheduleLowPriorityLoads);
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", onPopState);
  window.removeEventListener("keydown", onGlobalShortcut);
  selectedEtfDateAbort?.abort(); dashboardAbort?.abort(); globalAbort?.abort();
});
</script>

<template>
  <main class="app-shell p0-shell">
    <header class="p0-topbar">
      <a class="brand-link" href="/" @pointerenter="prefetchRouteComponent('/')" @focus="prefetchRouteComponent('/')" @click.prevent="navigate('/')">
        <span class="brand-mark"><img src="/assets/logo-mark.svg" alt="" aria-hidden="true" /></span>
        <span><b>ETF 持倉雷達</b><small>Active ETF Intelligence</small></span>
      </a>
      <nav class="desktop-primary-nav" aria-label="主要導覽">
        <a href="/" :class="{ active: route.view === 'daily' }" @pointerenter="prefetchRouteComponent('/')" @focus="prefetchRouteComponent('/')" @click.prevent="navigate('/')">今日情報</a>
        <a href="/market" :class="{ active: route.view === 'market' || route.view === 'taiwanEtf' }" @pointerenter="prefetchRouteComponent('/market')" @focus="prefetchRouteComponent('/market')" @click.prevent="navigate('/market')">台灣 ETF</a>
        <a href="/global-etfs" :class="{ active: route.view === 'globalMarket' || route.view === 'globalEtf' }" @pointerenter="prefetchRouteComponent('/global-etfs')" @focus="prefetchRouteComponent('/global-etfs')" @click.prevent="navigate('/global-etfs')">海外 ETF</a>
        <a href="/institutions" :class="{ active: route.view === 'institutions' || route.view === 'institution' }" @pointerenter="prefetchRouteComponent('/institutions')" @focus="prefetchRouteComponent('/institutions')" @click.prevent="navigate('/institutions')">機構 13F</a>
        <a href="/stocks" :class="{ active: route.view === 'stocks' || route.view === 'stock' }" @pointerenter="prefetchRouteComponent('/stocks')" @focus="prefetchRouteComponent('/stocks')" @click.prevent="navigate('/stocks')">股票</a>
        <a href="/performance" :class="{ active: route.view === 'performance' }" @pointerenter="prefetchRouteComponent('/performance')" @focus="prefetchRouteComponent('/performance')" @click.prevent="navigate('/performance')">績效排行</a>
        <a href="/compare/etfs" :class="{ active: route.view === 'compareEtfs' }" @pointerenter="prefetchRouteComponent('/compare/etfs')" @focus="prefetchRouteComponent('/compare/etfs')" @click.prevent="navigate('/compare/etfs')">比較</a>
        <a href="/signals" :class="{ active: route.view === 'signals' }" @pointerenter="prefetchRouteComponent('/signals')" @focus="prefetchRouteComponent('/signals')" @click.prevent="navigate('/signals')">訊號</a>
      </nav>
      <div class="top-actions">
        <button class="global-search-button" type="button" aria-label="開啟全站搜尋" title="全站搜尋（Cmd/Ctrl + K）" @pointerenter="prefetchRouteComponent('/search')" @focus="prefetchRouteComponent('/search')" @click="isMobileSearchOpen = true"><Search :size="16" /><span>搜尋</span><kbd>⌘K</kbd></button>
        <a class="telegram-link" :href="telegramUrl" target="_blank" rel="noreferrer" :aria-disabled="telegramInfo && !telegramInfo.configured">Telegram</a>
        <label v-if="isTaiwanMarketArea" class="date-control"><Calendar :size="15" /><select v-model="marketDate" aria-label="台灣市場資料日期" @change="loadMarketDashboard()"><option v-if="!marketAvailableDates.length" value="">載入中</option><option v-for="date in marketAvailableDates" :key="date" :value="date">{{ marketDateLabel(date) }}</option></select></label>
        <label v-else-if="isTaiwanEtfArea" class="date-control"><Calendar :size="15" /><select v-model="selectedEtfDate" aria-label="單檔 ETF 資料日期" @change="loadSelectedEtfDashboard()"><option v-if="!selectedEtfAvailableDates.length" value="">載入中</option><option v-for="date in selectedEtfAvailableDates" :key="date" :value="date">{{ date }}</option></select></label>
        <label v-else-if="isGlobalArea" class="date-control"><Calendar :size="15" /><select v-model="selectedGlobalDate" aria-label="海外資料日期" @change="loadGlobalReport(true)"><option v-if="!globalAvailableDates.length" value="">載入中</option><option v-for="date in globalAvailableDates" :key="date" :value="date">{{ date }}</option></select></label>
        <button class="theme-button" type="button" :aria-label="isDarkMode ? '切換至淺色模式' : '切換至深色模式'" :title="isDarkMode ? '切換至淺色模式' : '切換至深色模式'" @click="toggleColorMode"><Sun v-if="isDarkMode" :size="17" /><Moon v-else :size="17" /></button>
        <button class="refresh-button" type="button" :disabled="isTaiwanLoading || isGlobalLoading" aria-label="重新整理資料" @click="refreshCurrent"><RefreshCw :size="17" :class="{ spinning: isTaiwanLoading || isGlobalLoading }" /></button>
      </div>
    </header>

    <nav v-if="route.view === 'market' || route.view === 'taiwanEtf'" class="area-subnav" aria-label="台灣 ETF 導覽"><a href="/market" :class="{ active: route.view === 'market' }" @pointerenter="prefetchRouteComponent('/market')" @focus="prefetchRouteComponent('/market')" @click.prevent="navigate('/market')"><Layers :size="16" />市場總覽</a><a :href="`/etf/${selectedEtfCode}`" :class="{ active: route.view === 'taiwanEtf' }" @pointerenter="prefetchRouteComponent(`/etf/${selectedEtfCode}`)" @focus="prefetchRouteComponent(`/etf/${selectedEtfCode}`)" @click.prevent="navigate(`/etf/${selectedEtfCode}`)"><ListChecks :size="16" />單檔 ETF</a></nav>
    <nav v-if="route.view === 'globalMarket' || route.view === 'globalEtf'" class="area-subnav" aria-label="海外 ETF 導覽"><a href="/global-etfs" :class="{ active: route.view === 'globalMarket' }" @pointerenter="prefetchRouteComponent('/global-etfs')" @focus="prefetchRouteComponent('/global-etfs')" @click.prevent="navigate('/global-etfs')"><Globe2 :size="16" />市場總覽</a><a :href="`/global-etfs/${selectedGlobalCode}`" :class="{ active: route.view === 'globalEtf' }" @pointerenter="prefetchRouteComponent(`/global-etfs/${selectedGlobalCode}`)" @focus="prefetchRouteComponent(`/global-etfs/${selectedGlobalCode}`)" @click.prevent="navigate(`/global-etfs/${selectedGlobalCode}`)"><ListChecks :size="16" />單檔 ETF</a></nav>
    <nav v-if="parentNavigation" class="context-back-nav" aria-label="上一層導覽"><a :href="parentNavigation.path" @pointerenter="prefetchRouteComponent(parentNavigation.path)" @focus="prefetchRouteComponent(parentNavigation.path)" @click.prevent="navigate(parentNavigation.path)"><ArrowLeft :size="17" />{{ parentNavigation.label }}</a></nav>

    <section v-if="isTaiwanMarketArea && newerPartialMarketDate" class="newer-date-notice" aria-label="較新資料日揭露進度">
      <div><b>較新資料持續揭露中</b><span>{{ newerPartialMarketDate.date }} 已有 {{ newerPartialMarketDate.availableCount }} / {{ newerPartialMarketDate.trackedCount }} 檔更新；目前預設顯示涵蓋較完整的 {{ marketDate }}。</span></div>
      <button type="button" @click="showNewerPartialMarketDate">查看 {{ newerPartialMarketDate.date }}</button>
    </section>

    <p v-if="taiwanError && isTaiwanArea" class="app-alert">{{ taiwanError }}</p>

    <DailyBriefView v-if="route.view === 'daily'" :impacts="dashboard.stockImpact.impacts" :sectors="dashboard.stockImpact.sectorSummary.sectors" :coverage="dashboard.coverage" :selected-date="marketDate" :is-loading="isTaiwanLoading" @navigate="navigate" @stock="showMarketStock" />
    <TaiwanMarketView v-else-if="route.view === 'market'" :impacts="dashboard.stockImpact.impacts" :sectors="dashboard.stockImpact.sectorSummary.sectors" :coverage="dashboard.coverage" :selected-date="marketDate" :loading="isTaiwanLoading" :focus-stock-id="focusStockId" @etf="selectTaiwanEtf" @stock="showMarketStock" />
    <TaiwanEtfView v-else-if="route.view === 'taiwanEtf'" :options="etfOptions" :selected-code="selectedEtfCode" :page="route.etfPage ?? 'report'" :section="route.etfSection ?? 'overview'" :selected-date="selectedEtfDate" :source-latest-date="selectedEtfCoverage?.latestTradeDate ?? '-'" :summary="dashboard.summary" :summaries="dashboard.summaries" :changes="dashboard.changes" :holdings="dashboard.holdings" :loading="isTaiwanLoading" @select="selectTaiwanEtf" @report="navigate(`/etf/${selectedEtfCode}`)" @changes="navigate(`/etf/${selectedEtfCode}/changes`)" @premium="navigate(`/etf/${selectedEtfCode}/premium-history`)" @style="navigate(`/etf/${selectedEtfCode}/style`)" />
    <GlobalMarketView v-else-if="route.view === 'globalMarket'" :report="globalReport" :loading="isGlobalLoading" :error="globalError" :selected-date="selectedGlobalDate" @etf="selectGlobalEtf" @institutions="navigate('/institutions')" />
    <GlobalEtfView v-else-if="route.view === 'globalEtf'" :report="globalReport" :options="globalEtfOptions" :selected-code="selectedGlobalCode" :loading="isGlobalLoading" :error="globalError" @select="selectGlobalEtf" />
    <InstitutionView v-else-if="route.view === 'institutions' || route.view === 'institution'" :report="globalReport" :options="institutionOptions" :selected-code="route.view === 'institution' ? selectedInstitutionCode : undefined" :loading="isGlobalLoading" :error="globalError" @select="selectInstitution" />
    <StocksIndexView v-else-if="route.view === 'stocks'" @navigate="navigate" />
    <div v-else-if="route.view === 'stock'" class="p1-route-slot p1-route-slot--stock"><StockDetailView :market="route.stockMarket ?? 'tw'" :symbol="route.stockSymbol ?? ''" :refresh-key="p1RefreshKey" /></div>
    <FundPerformanceView v-else-if="route.view === 'performance'" :refresh-key="p1RefreshKey" @navigate="navigate" />
    <EtfCompareView v-else-if="route.view === 'compareEtfs'" :type="route.compareType ?? 'tw'" :codes="route.compareCodes ?? []" :refresh-key="p1RefreshKey" @navigate="navigate" />
    <SignalsView v-else-if="route.view === 'signals'" :kind="route.signalKind ?? 'all'" :refresh-key="p1RefreshKey" @navigate="navigate" />
    <EtfStyleView v-else-if="route.view === 'etfStyle'" :code="route.etfCode ?? ''" :refresh-key="p1RefreshKey" />
    <SearchResultsView v-else-if="route.view === 'search'" :query="route.searchQuery ?? ''" @navigate="navigate" @query="updateSearchQuery" />
    <MethodologyView v-else-if="route.view === 'methodology'" />
    <NotFoundView v-else :path="route.path" @navigate="navigate" />

    <ForvixMarketEmbed v-if="shouldShowForvixEmbed" />

    <footer class="p0-footer">
      <p>本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。</p>
      <span><a href="/methodology" @pointerenter="prefetchRouteComponent('/methodology')" @focus="prefetchRouteComponent('/methodology')">方法論</a><a href="/active-etfs/">追蹤 ETF 清單</a><a href="/data-usage/">資料來源與使用說明</a></span>
    </footer>

    <nav class="mobile-primary-nav" aria-label="行動版主要導覽">
      <a href="/" :class="{ active: route.view === 'daily' }" @pointerdown="prefetchRouteComponent('/')" @click.prevent="navigate('/')"><Home :size="20" /><span>今日</span></a>
      <a href="/market" :class="{ active: route.view === 'market' || route.view === 'taiwanEtf' }" @pointerdown="prefetchRouteComponent('/market')" @click.prevent="navigate('/market')"><Layers :size="20" /><span>台灣</span></a>
      <a href="/global-etfs" :class="{ active: route.view === 'globalMarket' || route.view === 'globalEtf' || route.view === 'institutions' || route.view === 'institution' }" @pointerdown="prefetchRouteComponent('/global-etfs')" @click.prevent="navigate('/global-etfs')"><Globe2 :size="20" /><span>海外</span></a>
      <a href="/performance" :class="{ active: route.view === 'performance' }" @pointerdown="prefetchRouteComponent('/performance')" @click.prevent="navigate('/performance')"><Trophy :size="20" /><span>排行</span></a>
      <button type="button" :class="{ active: isMobileSearchOpen || route.view === 'stocks' || route.view === 'stock' || route.view === 'search' || route.view === 'compareEtfs' || route.view === 'signals' }" @pointerdown="prefetchRouteComponent('/search')" @click="isMobileSearchOpen = true"><Search :size="20" /><span>搜尋</span></button>
    </nav>

    <div v-if="isMobileSearchOpen" class="global-search-overlay" role="dialog" aria-modal="true" aria-label="全站搜尋" @click.self="isMobileSearchOpen = false">
      <GlobalSearchDialog @close="isMobileSearchOpen = false" @navigate="navigate" />
    </div>
  </main>
</template>

<style scoped>
.p0-shell{display:grid;gap:16px;width:min(1380px,100%);margin:0 auto;padding:18px 22px 96px}.p1-route-slot--stock{min-height:1900px}.p1-route-slot--stock:has(.p1-error){min-height:0}.p0-topbar{position:sticky;top:0;z-index:50;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;min-height:68px;padding:9px 14px;border:1px solid rgba(215,225,229,.92);border-radius:13px;background:rgba(255,255,255,.94);box-shadow:0 8px 28px rgba(28,48,65,.08);backdrop-filter:blur(14px)}.brand-link{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#25333e;text-align:left;cursor:pointer}.brand-mark{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:#eef5f4}.brand-mark img{width:29px;height:29px}.brand-link>span:last-child{display:grid;gap:1px}.brand-link b{font-size:15px}.brand-link small{color:#7a8791;font-size:10px}.desktop-primary-nav{display:flex;justify-content:center;gap:2px}.desktop-primary-nav button{min-height:42px;padding:0 10px;border:0;border-radius:9px;background:transparent;color:#64717c;font-size:13px;font-weight:760;cursor:pointer}.desktop-primary-nav button.active{background:#173f56;color:#fff}.top-actions{display:flex;align-items:center;gap:7px}.global-search-button{display:flex;align-items:center;gap:6px;min-height:40px;padding:0 8px;border:1px solid #d7e0e4;border-radius:8px;background:#fff;color:#456176;font-size:12px;font-weight:760}.global-search-button kbd{padding:2px 4px;border:1px solid #d7e0e4;border-radius:4px;background:#f5f8f9;color:#73818b;font-size:10px}.telegram-link{display:flex;align-items:center;min-height:40px;padding:0 10px;border:1px solid #d7e0e4;border-radius:8px;color:#345986;font-size:12px;font-weight:760;text-decoration:none}.date-control{display:flex;align-items:center;gap:6px;height:40px;padding:0 8px;border:1px solid #d7e0e4;border-radius:8px;color:#61707b}.date-control select{border:0;outline:0;background:#fff;color:#35424e;font-size:12px}.theme-button,.refresh-button{display:grid;place-items:center;width:40px;height:40px;border:1px solid #d7e0e4;border-radius:8px;background:#fff;color:#456176;cursor:pointer}.refresh-button:disabled{opacity:.55}.spinning{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.area-subnav{display:flex;justify-content:center;gap:5px}.area-subnav button{display:flex;align-items:center;gap:7px;min-height:42px;padding:0 15px;border:1px solid #dce4e8;border-radius:9px;background:#fff;color:#65727d;font-weight:760;cursor:pointer}.area-subnav button.active{border-color:#173f56;background:#173f56;color:#fff}.context-back-nav{display:flex}.context-back-nav button{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border:1px solid #d6e0e5;border-radius:9px;background:#fff;color:#345986;font-weight:780;cursor:pointer}.context-back-nav button:hover{border-color:#8ca5b9;background:#f7fafb}.newer-date-notice{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid #b9d7d3;border-radius:10px;background:#edf8f6;color:#29464d}.newer-date-notice>div{display:grid;gap:3px}.newer-date-notice b{font-size:13px}.newer-date-notice span{font-size:12px;line-height:1.5}.newer-date-notice button{flex:0 0 auto;min-height:38px;padding:0 12px;border:1px solid #0d7770;border-radius:8px;background:#fff;color:#0d6f69;font-weight:760;cursor:pointer}.app-alert{margin:0;padding:13px 15px;border:1px solid #f1c4c0;border-radius:10px;background:#fff4f3;color:#a8322a}.p0-footer{display:flex;justify-content:space-between;gap:20px;padding:20px 4px;color:#6d7984;font-size:12px;line-height:1.6}.p0-footer p{margin:0}.p0-footer span{display:flex;gap:14px}.p0-footer a{color:#47657f;font-weight:720}.mobile-primary-nav,.mobile-search-overlay{display:none}.global-search-overlay{position:fixed;inset:0;z-index:110;display:grid;place-items:center;padding:16px;background:rgba(7,22,34,.56);backdrop-filter:blur(4px)}
@media(max-width:1120px){.p0-topbar{grid-template-columns:auto 1fr}.desktop-primary-nav{grid-row:2;grid-column:1 / -1;order:3}.top-actions{justify-self:end}.telegram-link{display:none}}
@media(max-width:760px){.p0-shell{gap:12px;padding:10px 10px calc(92px + env(safe-area-inset-bottom))}.p1-route-slot--stock{min-height:4800px}.p0-topbar{position:relative;grid-template-columns:1fr auto;min-height:58px;padding:8px 10px}.desktop-primary-nav,.top-actions .date-control,.global-search-button{display:none}.top-actions{justify-self:end}.theme-button,.refresh-button{width:42px;height:42px}.area-subnav{justify-content:stretch;overflow:auto;padding-bottom:1px}.area-subnav button{flex:1 0 auto;min-height:44px}.context-back-nav button{width:100%;justify-content:flex-start}.newer-date-notice{display:grid;gap:10px}.newer-date-notice button{width:100%;min-height:44px}.p0-footer{display:grid;padding:16px 4px 8px}.p0-footer span{flex-wrap:wrap}.mobile-primary-nav{position:fixed;left:0;right:0;bottom:0;z-index:80;display:grid;grid-template-columns:repeat(5,1fr);padding:6px 8px calc(6px + env(safe-area-inset-bottom));border-top:1px solid #d7e0e4;background:rgba(255,255,255,.97);box-shadow:0 -8px 28px rgba(25,45,62,.09);backdrop-filter:blur(14px)}.mobile-primary-nav button{display:grid;justify-items:center;align-content:center;gap:3px;min-height:52px;border:0;border-radius:9px;background:transparent;color:#64727c;font-size:11px;font-weight:740}.mobile-primary-nav button.active{background:#eaf3f2;color:#0c756e}.global-search-overlay{place-items:end center;padding:0}}
.brand-link{text-decoration:none}.desktop-primary-nav a{display:flex;align-items:center;min-height:42px;padding:0 10px;border-radius:9px;color:#64717c;font-size:13px;font-weight:760;text-decoration:none}.desktop-primary-nav a.active{background:#173f56;color:#fff}.area-subnav a{display:flex;align-items:center;gap:7px;min-height:42px;padding:0 15px;border:1px solid #dce4e8;border-radius:9px;background:#fff;color:#65727d;font-weight:760;text-decoration:none}.area-subnav a.active{border-color:#173f56;background:#173f56;color:#fff}.context-back-nav a{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border:1px solid #d6e0e5;border-radius:9px;background:#fff;color:#345986;font-weight:780;text-decoration:none}.context-back-nav a:hover{border-color:#8ca5b9;background:#f7fafb}
@media(max-width:760px){.area-subnav a{flex:1 0 auto;min-height:44px}.context-back-nav a{width:100%;justify-content:flex-start}.mobile-primary-nav a{display:grid;justify-items:center;align-content:center;gap:3px;min-height:52px;border-radius:9px;color:#64727c;font-size:11px;font-weight:740;text-decoration:none}.mobile-primary-nav a.active{background:#eaf3f2;color:#0c756e}}
</style>
