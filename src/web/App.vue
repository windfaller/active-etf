<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowLeft, Building2, Calendar, Globe2, Home, Layers, ListChecks, Moon, RefreshCw, Search, Sun, X } from "@lucide/vue";
import { configuredEtfs } from "../config/etfs";
import { enabledGlobalEtfs } from "../config/globalEtfs";
import AdSlot from "../components/ads/AdSlot";
import type { DashboardResponse, EtfCoverageResponse } from "./contracts/dashboard";
import { emptyChanges } from "./contracts/dashboard";
import type { GlobalEtfOption, GlobalEtfUniverseResponse, GlobalReport } from "./contracts/global";
import type { AppRoute } from "./contracts/navigation";
import { useColorMode } from "./composables/useColorMode";
import { notFoundMetadata, routeMetadataForPath, routeStructuredData, SITE_ORIGIN } from "./seo/routeMetadata";
import DailyBriefView from "./views/DailyBriefView.vue";
import GlobalEtfView from "./views/GlobalEtfView.vue";
import GlobalMarketView from "./views/GlobalMarketView.vue";
import InstitutionView from "./views/InstitutionView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import TaiwanEtfView from "./views/TaiwanEtfView.vue";
import TaiwanMarketView from "./views/TaiwanMarketView.vue";

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

const apiBase = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:7072" : "");
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
const { isDarkMode, toggleColorMode } = useColorMode();
const marketDateCoverageThreshold = 0.7;

const dashboard = computed(() => route.value.view === "taiwanEtf" ? selectedEtfDashboard.value : marketDashboard.value);
const selectedEtfCoverage = computed(() => selectedEtfDashboard.value.coverage.etfs.find((etf) => etf.etfCode === selectedEtfCode.value) ?? null);
const globalEtfOptions = computed(() => globalOptions.value.filter((option) => option.strategyType !== "13f"));
const institutionOptions = computed(() => globalOptions.value.filter((option) => option.strategyType === "13f"));
const isTaiwanArea = computed(() => ["daily", "market", "taiwanEtf"].includes(route.value.view));
const isTaiwanMarketArea = computed(() => route.value.view === "daily" || route.value.view === "market");
const isTaiwanEtfArea = computed(() => route.value.view === "taiwanEtf");
const isGlobalArea = computed(() => ["globalMarket", "globalEtf", "institutions", "institution"].includes(route.value.view));
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
  return null;
});

function cleanPath(pathname: string): string {
  const path = pathname.replace(/\/+$/u, "");
  return path || "/";
}

function routeFromPath(pathname: string): AppRoute {
  const path = cleanPath(pathname);
  const parts = path.split("/").filter(Boolean);
  if (path === "/") return { view: "daily", path };
  if (path === "/market") return { view: "market", path };

  if (parts[0] === "etf" && parts[1]) {
    const code = parts[1].toUpperCase();
    if (!knownTaiwanCodes.has(code)) return { view: "notFound", path };
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
  const metadata = routeMetadataForPath(route.value.path) ?? notFoundMetadata(route.value.path);
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

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return await response.json() as T;
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
    const bootstrapParams = new URLSearchParams({ limit: "180" });
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
  route.value = routeFromPath(window.location.pathname);
  if (route.value.etfCode) selectedEtfCode.value = route.value.etfCode;
  if (route.value.globalCode) selectedGlobalCode.value = route.value.globalCode;
  if (route.value.institutionCode) selectedInstitutionCode.value = route.value.institutionCode;
  updateDocumentMetadata();
}

async function navigate(path: string, replace = false): Promise<void> {
  const next = cleanPath(path);
  if (cleanPath(window.location.pathname) !== next) window.history[replace ? "replaceState" : "pushState"]({}, "", next);
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
}

function onPopState(): void { applyRouteFromLocation(); void loadForCurrentRoute(); }

onMounted(() => {
  applyRouteFromLocation();
  window.addEventListener("popstate", onPopState);
  void loadForCurrentRoute();
  const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number };
  if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => void loadTelegramInfo());
  else window.setTimeout(() => void loadTelegramInfo(), 1200);
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", onPopState);
  selectedEtfDateAbort?.abort(); dashboardAbort?.abort(); globalAbort?.abort();
});
</script>

<template>
  <main class="app-shell p0-shell">
    <header class="p0-topbar">
      <button class="brand-link" type="button" @click="navigate('/')">
        <span class="brand-mark"><img src="/assets/logo-mark.svg" alt="" aria-hidden="true" /></span>
        <span><b>ETF 持倉雷達</b><small>Active ETF Intelligence</small></span>
      </button>
      <nav class="desktop-primary-nav" aria-label="主要導覽">
        <button type="button" :class="{ active: route.view === 'daily' }" @click="navigate('/')">今日情報</button>
        <button type="button" :class="{ active: route.view === 'market' || route.view === 'taiwanEtf' }" @click="navigate('/market')">台灣 ETF</button>
        <button type="button" :class="{ active: route.view === 'globalMarket' || route.view === 'globalEtf' }" @click="navigate('/global-etfs')">海外 ETF</button>
        <button type="button" :class="{ active: route.view === 'institutions' || route.view === 'institution' }" @click="navigate('/institutions')">機構 13F</button>
      </nav>
      <div class="top-actions">
        <a class="telegram-link" :href="telegramUrl" target="_blank" rel="noreferrer" :aria-disabled="telegramInfo && !telegramInfo.configured">Telegram</a>
        <label v-if="isTaiwanMarketArea" class="date-control"><Calendar :size="15" /><select v-model="marketDate" aria-label="台灣市場資料日期" @change="loadMarketDashboard()"><option v-if="!marketAvailableDates.length" value="">載入中</option><option v-for="date in marketAvailableDates" :key="date" :value="date">{{ marketDateLabel(date) }}</option></select></label>
        <label v-else-if="isTaiwanEtfArea" class="date-control"><Calendar :size="15" /><select v-model="selectedEtfDate" aria-label="單檔 ETF 資料日期" @change="loadSelectedEtfDashboard()"><option v-if="!selectedEtfAvailableDates.length" value="">載入中</option><option v-for="date in selectedEtfAvailableDates" :key="date" :value="date">{{ date }}</option></select></label>
        <label v-else-if="isGlobalArea" class="date-control"><Calendar :size="15" /><select v-model="selectedGlobalDate" aria-label="海外資料日期" @change="loadGlobalReport(true)"><option v-if="!globalAvailableDates.length" value="">載入中</option><option v-for="date in globalAvailableDates" :key="date" :value="date">{{ date }}</option></select></label>
        <button class="theme-button" type="button" :aria-label="isDarkMode ? '切換至淺色模式' : '切換至深色模式'" :title="isDarkMode ? '切換至淺色模式' : '切換至深色模式'" @click="toggleColorMode"><Sun v-if="isDarkMode" :size="17" /><Moon v-else :size="17" /></button>
        <button class="refresh-button" type="button" :disabled="isTaiwanLoading || isGlobalLoading" aria-label="重新整理資料" @click="refreshCurrent"><RefreshCw :size="17" :class="{ spinning: isTaiwanLoading || isGlobalLoading }" /></button>
      </div>
    </header>

    <nav v-if="route.view === 'market' || route.view === 'taiwanEtf'" class="area-subnav" aria-label="台灣 ETF 導覽"><button type="button" :class="{ active: route.view === 'market' }" @click="navigate('/market')"><Layers :size="16" />市場總覽</button><button type="button" :class="{ active: route.view === 'taiwanEtf' }" @click="navigate(`/etf/${selectedEtfCode}`)"><ListChecks :size="16" />單檔 ETF</button></nav>
    <nav v-if="route.view === 'globalMarket' || route.view === 'globalEtf'" class="area-subnav" aria-label="海外 ETF 導覽"><button type="button" :class="{ active: route.view === 'globalMarket' }" @click="navigate('/global-etfs')"><Globe2 :size="16" />市場總覽</button><button type="button" :class="{ active: route.view === 'globalEtf' }" @click="navigate(`/global-etfs/${selectedGlobalCode}`)"><ListChecks :size="16" />單檔 ETF</button></nav>
    <nav v-if="parentNavigation" class="context-back-nav" aria-label="上一層導覽"><button type="button" @click="navigate(parentNavigation.path)"><ArrowLeft :size="17" />{{ parentNavigation.label }}</button></nav>

    <section v-if="isTaiwanMarketArea && newerPartialMarketDate" class="newer-date-notice" aria-label="較新資料日揭露進度">
      <div><b>較新資料持續揭露中</b><span>{{ newerPartialMarketDate.date }} 已有 {{ newerPartialMarketDate.availableCount }} / {{ newerPartialMarketDate.trackedCount }} 檔更新；目前預設顯示涵蓋較完整的 {{ marketDate }}。</span></div>
      <button type="button" @click="showNewerPartialMarketDate">查看 {{ newerPartialMarketDate.date }}</button>
    </section>

    <p v-if="taiwanError && isTaiwanArea" class="app-alert">{{ taiwanError }}</p>

    <DailyBriefView v-if="route.view === 'daily'" :impacts="dashboard.stockImpact.impacts" :sectors="dashboard.stockImpact.sectorSummary.sectors" :coverage="dashboard.coverage" :selected-date="marketDate" :is-loading="isTaiwanLoading" @navigate="navigate" @stock="showMarketStock" />
    <TaiwanMarketView v-else-if="route.view === 'market'" :impacts="dashboard.stockImpact.impacts" :sectors="dashboard.stockImpact.sectorSummary.sectors" :coverage="dashboard.coverage" :selected-date="marketDate" :loading="isTaiwanLoading" :focus-stock-id="focusStockId" @etf="selectTaiwanEtf" @stock="showMarketStock" />
    <TaiwanEtfView v-else-if="route.view === 'taiwanEtf'" :options="etfOptions" :selected-code="selectedEtfCode" :page="route.etfPage ?? 'report'" :section="route.etfSection ?? 'overview'" :selected-date="selectedEtfDate" :source-latest-date="selectedEtfCoverage?.latestTradeDate ?? '-'" :summary="dashboard.summary" :summaries="dashboard.summaries" :changes="dashboard.changes" :holdings="dashboard.holdings" :loading="isTaiwanLoading" @select="selectTaiwanEtf" @report="navigate(`/etf/${selectedEtfCode}`)" @changes="navigate(`/etf/${selectedEtfCode}/changes`)" @premium="navigate(`/etf/${selectedEtfCode}/premium-history`)" />
    <GlobalMarketView v-else-if="route.view === 'globalMarket'" :report="globalReport" :loading="isGlobalLoading" :error="globalError" :selected-date="selectedGlobalDate" @etf="selectGlobalEtf" @institutions="navigate('/institutions')" />
    <GlobalEtfView v-else-if="route.view === 'globalEtf'" :report="globalReport" :options="globalEtfOptions" :selected-code="selectedGlobalCode" :loading="isGlobalLoading" :error="globalError" @select="selectGlobalEtf" />
    <InstitutionView v-else-if="route.view === 'institutions' || route.view === 'institution'" :report="globalReport" :options="institutionOptions" :selected-code="route.view === 'institution' ? selectedInstitutionCode : undefined" :loading="isGlobalLoading" :error="globalError" @select="selectInstitution" />
    <NotFoundView v-else :path="route.path" @navigate="navigate" />

    <AdSlot v-if="route.view !== 'daily' && route.view !== 'notFound'" slot="article-inline" mode="compact" compact :page="route.path" :etf-code="route.etfCode ?? route.globalCode" :tags="globalReport?.adContext.tags ?? ['active-etf','institutional-flow']" />

    <footer class="p0-footer">
      <p>本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。</p>
      <span><a href="/active-etfs/">追蹤 ETF 清單</a><a href="/data-usage/">資料來源與使用說明</a></span>
    </footer>

    <nav class="mobile-primary-nav" aria-label="行動版主要導覽">
      <button type="button" :class="{ active: route.view === 'daily' }" @click="navigate('/')"><Home :size="20" /><span>今日</span></button>
      <button type="button" :class="{ active: route.view === 'market' || route.view === 'taiwanEtf' }" @click="navigate('/market')"><Layers :size="20" /><span>台灣</span></button>
      <button type="button" :class="{ active: route.view === 'globalMarket' || route.view === 'globalEtf' || route.view === 'institutions' || route.view === 'institution' }" @click="navigate('/global-etfs')"><Globe2 :size="20" /><span>海外</span></button>
      <button type="button" :class="{ active: isMobileSearchOpen }" @click="isMobileSearchOpen = true"><Search :size="20" /><span>搜尋</span></button>
    </nav>

    <div v-if="isMobileSearchOpen" class="mobile-search-overlay" role="dialog" aria-modal="true" aria-label="ETF 與機構搜尋" @click.self="isMobileSearchOpen = false">
      <section><header><div><b>搜尋與快速前往</b><small>台灣 ETF、海外 ETF 與機構 13F</small></div><button type="button" aria-label="關閉搜尋" @click="isMobileSearchOpen = false"><X :size="20" /></button></header>
        <label><span>台灣 ETF</span><select @change="selectTaiwanEtf(($event.target as HTMLSelectElement).value)"><option value="">選擇 ETF</option><option v-for="etf in etfOptions" :key="etf.etfCode" :value="etf.etfCode">{{ etf.etfCode }} {{ etf.name }}</option></select></label>
        <label><span>海外 ETF</span><select @change="selectGlobalEtf(($event.target as HTMLSelectElement).value)"><option value="">選擇 ETF</option><option v-for="etf in globalEtfOptions" :key="etf.etfCode" :value="etf.etfCode">{{ etf.etfCode }} {{ etf.fundName }}</option></select></label>
        <button class="institution-search-link" type="button" @click="navigate('/institutions')"><Building2 :size="19" />機構 13F 季度持倉</button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.p0-shell{display:grid;gap:16px;width:min(1380px,100%);margin:0 auto;padding:18px 22px 96px}.p0-topbar{position:sticky;top:0;z-index:50;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:22px;min-height:68px;padding:9px 14px;border:1px solid rgba(215,225,229,.92);border-radius:13px;background:rgba(255,255,255,.94);box-shadow:0 8px 28px rgba(28,48,65,.08);backdrop-filter:blur(14px)}.brand-link{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#25333e;text-align:left;cursor:pointer}.brand-mark{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:#eef5f4}.brand-mark img{width:29px;height:29px}.brand-link>span:last-child{display:grid;gap:1px}.brand-link b{font-size:15px}.brand-link small{color:#7a8791;font-size:10px}.desktop-primary-nav{display:flex;justify-content:center;gap:3px}.desktop-primary-nav button{min-height:42px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:#64717c;font-weight:760;cursor:pointer}.desktop-primary-nav button.active{background:#173f56;color:#fff}.top-actions{display:flex;align-items:center;gap:7px}.telegram-link{display:flex;align-items:center;min-height:40px;padding:0 10px;border:1px solid #d7e0e4;border-radius:8px;color:#345986;font-size:12px;font-weight:760;text-decoration:none}.date-control{display:flex;align-items:center;gap:6px;height:40px;padding:0 8px;border:1px solid #d7e0e4;border-radius:8px;color:#61707b}.date-control select{border:0;outline:0;background:#fff;color:#35424e;font-size:12px}.theme-button,.refresh-button{display:grid;place-items:center;width:40px;height:40px;border:1px solid #d7e0e4;border-radius:8px;background:#fff;color:#456176;cursor:pointer}.refresh-button:disabled{opacity:.55}.spinning{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.area-subnav{display:flex;justify-content:center;gap:5px}.area-subnav button{display:flex;align-items:center;gap:7px;min-height:42px;padding:0 15px;border:1px solid #dce4e8;border-radius:9px;background:#fff;color:#65727d;font-weight:760;cursor:pointer}.area-subnav button.active{border-color:#173f56;background:#173f56;color:#fff}.context-back-nav{display:flex}.context-back-nav button{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border:1px solid #d6e0e5;border-radius:9px;background:#fff;color:#345986;font-weight:780;cursor:pointer}.context-back-nav button:hover{border-color:#8ca5b9;background:#f7fafb}.newer-date-notice{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid #b9d7d3;border-radius:10px;background:#edf8f6;color:#29464d}.newer-date-notice>div{display:grid;gap:3px}.newer-date-notice b{font-size:13px}.newer-date-notice span{font-size:12px;line-height:1.5}.newer-date-notice button{flex:0 0 auto;min-height:38px;padding:0 12px;border:1px solid #0d7770;border-radius:8px;background:#fff;color:#0d6f69;font-weight:760;cursor:pointer}.app-alert{margin:0;padding:13px 15px;border:1px solid #f1c4c0;border-radius:10px;background:#fff4f3;color:#a8322a}.p0-footer{display:flex;justify-content:space-between;gap:20px;padding:20px 4px;color:#6d7984;font-size:12px;line-height:1.6}.p0-footer p{margin:0}.p0-footer span{display:flex;gap:14px}.p0-footer a{color:#47657f;font-weight:720}.mobile-primary-nav,.mobile-search-overlay{display:none}
@media(max-width:1050px){.p0-topbar{grid-template-columns:auto 1fr}.desktop-primary-nav{grid-row:2;grid-column:1 / -1;order:3}.top-actions{justify-self:end}.telegram-link{display:none}}
@media(max-width:760px){.p0-shell{gap:12px;padding:10px 10px calc(92px + env(safe-area-inset-bottom))}.p0-topbar{position:relative;grid-template-columns:1fr auto;min-height:58px;padding:8px 10px}.desktop-primary-nav,.top-actions .date-control{display:none}.top-actions{justify-self:end}.theme-button,.refresh-button{width:42px;height:42px}.area-subnav{justify-content:stretch;overflow:auto;padding-bottom:1px}.area-subnav button{flex:1 0 auto;min-height:44px}.context-back-nav button{width:100%;justify-content:flex-start}.newer-date-notice{display:grid;gap:10px}.newer-date-notice button{width:100%;min-height:44px}.p0-footer{display:grid;padding:16px 4px 8px}.p0-footer span{flex-wrap:wrap}.mobile-primary-nav{position:fixed;left:0;right:0;bottom:0;z-index:80;display:grid;grid-template-columns:repeat(4,1fr);padding:6px 8px calc(6px + env(safe-area-inset-bottom));border-top:1px solid #d7e0e4;background:rgba(255,255,255,.97);box-shadow:0 -8px 28px rgba(25,45,62,.09);backdrop-filter:blur(14px)}.mobile-primary-nav button{display:grid;justify-items:center;align-content:center;gap:3px;min-height:52px;border:0;border-radius:9px;background:transparent;color:#64727c;font-size:11px;font-weight:740}.mobile-primary-nav button.active{background:#eaf3f2;color:#0c756e}.mobile-search-overlay{position:fixed;inset:0;z-index:100;display:grid;align-items:end;background:rgba(7,22,34,.48)}.mobile-search-overlay>section{display:grid;gap:16px;padding:20px 16px calc(22px + env(safe-area-inset-bottom));border-radius:18px 18px 0 0;background:#fff;box-shadow:0 -20px 60px rgba(7,22,34,.18)}.mobile-search-overlay header{display:flex;justify-content:space-between;gap:16px}.mobile-search-overlay header>div{display:grid;gap:4px}.mobile-search-overlay header small{color:#64727c}.mobile-search-overlay header button{display:grid;place-items:center;width:44px;height:44px;border:1px solid #d9e1e5;border-radius:9px;background:#fff}.mobile-search-overlay label{display:grid;gap:6px;color:#5e6c77;font-size:12px;font-weight:760}.mobile-search-overlay select{width:100%;height:48px;padding:0 12px;border:1px solid #d4dee2;border-radius:9px;background:#fff}.institution-search-link{display:flex;align-items:center;gap:9px;min-height:48px;padding:0 13px;border:0;border-radius:9px;background:#173f56;color:#fff;font-weight:760}}
</style>
