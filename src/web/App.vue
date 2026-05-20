<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Database,
  Layers,
  LineChart,
  ListChecks,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp
} from "@lucide/vue";
import { configuredEtfs } from "../config/etfs";
import AdSlot from "../components/ads/AdSlot";

type NullableNumber = number | null;
type MainTab = "market" | "etf";
type EtfPage = "report" | "premiumHistory";

interface Holding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: NullableNumber;
  marketValue: NullableNumber;
}

interface Summary {
  tradeDate: string;
  nav: NullableNumber;
  marketPrice: NullableNumber;
  premiumDiscount: NullableNumber;
  totalUnits: NullableNumber;
  fundSize: NullableNumber;
  netCreationUnits: NullableNumber;
  cashRatio: NullableNumber;
  stockRatio: NullableNumber;
}

interface Change {
  stockId: string;
  stockName: string;
  prevShares: number;
  currentShares: number;
  diffShares: number;
  diffLots: number;
  diffPct: NullableNumber;
  prevWeight: NullableNumber;
  currentWeight: NullableNumber;
  diffWeightPoint: NullableNumber;
  expectedSharesByScale: NullableNumber;
  activeDiffShares: NullableNumber;
  activeDiffLots: NullableNumber;
  activeDiffPct: NullableNumber;
  activeSignalScore: NullableNumber;
  status: string;
}

interface ChangesResponse {
  topIncreases: Change[];
  topDecreases: Change[];
  topActiveIncreases: Change[];
  topActiveDecreases: Change[];
  newHoldings: Change[];
  exitedHoldings: Change[];
}

interface StockImpactEtf {
  etfCode: string;
  diffLots: number;
  activeDiffLots: NullableNumber;
  diffWeightPoint: NullableNumber;
  currentWeight: NullableNumber;
  status: string;
}

interface StockImpact {
  stockId: string;
  stockName: string;
  sector: string;
  etfCount: number;
  increaseEtfCount: number;
  decreaseEtfCount: number;
  totalDiffLots: number;
  totalActiveDiffLots: number;
  totalDiffWeightPoint: number;
  maxAbsActiveDiffLots: number;
  maxAbsDiffWeightPoint: number;
  impactScore: number;
  market: {
    market: "TWSE" | "TPEx";
    closePrice: NullableNumber;
    change: NullableNumber;
    changePercent: NullableNumber;
    volumeShares: NullableNumber;
    turnover: NullableNumber;
    transactionCount: NullableNumber;
  } | null;
  institutional: {
    foreignNetShares: NullableNumber;
    investmentTrustNetShares: NullableNumber;
    dealerNetShares: NullableNumber;
    totalNetShares: NullableNumber;
  } | null;
  primaryImpactEtf: StockImpactEtf | null;
  etfs: StockImpactEtf[];
}

interface SectorSummaryRow {
  sector: string;
  stockCount: number;
  etfCount: number;
  totalActiveDiffLots: number;
  totalInstitutionalNetLots: NullableNumber;
  totalTurnover: NullableNumber;
  topStocks: Array<{
    stockId: string;
    stockName: string;
    impactScore: number;
    totalActiveDiffLots: number;
  }>;
}

interface EtfCoverageRow {
  etfCode: string;
  name: string;
  issuer: string;
  providerId: string;
  latestTradeDate: string | null;
  hasSelectedDate: boolean;
  status: "available" | "stale" | "missing" | "newer_available";
  updatedAt: string | null;
}

interface EtfCoverageResponse {
  date: string | null;
  trackedCount: number;
  availableCount: number;
  staleCount: number;
  etfs: EtfCoverageRow[];
}

interface DashboardResponse {
  holdings: Holding[];
  summary: Summary | null;
  changes: ChangesResponse;
  summaries: Summary[];
  stockImpact: {
    impacts: StockImpact[];
    sectorSummary: {
      sectors: SectorSummaryRow[];
    };
  };
  coverage: EtfCoverageResponse;
}

interface TelegramInfo {
  configured: boolean;
  username: string | null;
  subscribeUrl: string | null;
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:7072" : "");
const etfOptions = configuredEtfs.filter((etf) => etf.enabled);
const etfNameByCode = new Map(etfOptions.map((etf) => [etf.etfCode, etf.name]));

const availableDates = ref<string[]>([]);
const selectedDate = ref("");
const selectedEtfCode = ref(etfOptions[0]?.etfCode ?? "00981A");
const activeMainTab = ref<MainTab>("market");
const activeEtfPage = ref<EtfPage>("report");
const marketQuery = ref("");
const holdingQuery = ref("");
const expandedSector = ref("");
const focusedStockImpactId = ref("");
const isLoading = ref(false);
const hasLoaded = ref(false);
const errorMessage = ref("");
const holdings = ref<Holding[]>([]);
const summary = ref<Summary | null>(null);
const summaryHistory = ref<Summary[]>([]);
const stockImpacts = ref<StockImpact[]>([]);
const sectorSummaryRows = ref<SectorSummaryRow[]>([]);
const coverage = ref<EtfCoverageResponse | null>(null);
const telegramInfo = ref<TelegramInfo | null>(null);
const changes = ref<ChangesResponse>({
  topIncreases: [],
  topDecreases: [],
  topActiveIncreases: [],
  topActiveDecreases: [],
  newHoldings: [],
  exitedHoldings: []
});

const selectedEtf = computed(
  () => etfOptions.find((etf) => etf.etfCode === selectedEtfCode.value) ?? etfOptions[0]
);

const displayedImpacts = computed(() => {
  const normalized = marketQuery.value.trim().toLowerCase();
  if (!normalized) return stockImpacts.value;

  return stockImpacts.value.filter((row) =>
    `${row.stockId} ${row.stockName} ${row.sector} ${row.etfs.map((etf) => etf.etfCode).join(" ")}`
      .toLowerCase()
      .includes(normalized)
  );
});

const displayedHoldings = computed(() => {
  const normalized = holdingQuery.value.trim().toLowerCase();
  const rows = [...holdings.value].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  if (!normalized) return rows;

  return rows.filter((row) => `${row.stockId} ${row.stockName}`.toLowerCase().includes(normalized));
});

const premiumRows = computed(() =>
  [...summaryHistory.value].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
);

const premiumValues = computed(() =>
  premiumRows.value
    .map((row) => row.premiumDiscount)
    .filter((value): value is number => value !== null && !Number.isNaN(value))
);
const premiumChartRows = computed(() =>
  premiumRows.value
    .filter((row) => row.premiumDiscount !== null && !Number.isNaN(row.premiumDiscount))
    .slice(0, 45)
    .reverse()
);

const premiumRange = computed(() => {
  const values = premiumValues.value;
  if (!values.length) return { min: -1, max: 1 };
  return {
    min: Math.min(-0.1, ...values),
    max: Math.max(0.1, ...values)
  };
});

const latestPremiumDate = computed(() => premiumRows.value[0]?.tradeDate ?? "-");
const activeIncreaseRows = computed(() => changes.value.topActiveIncreases.slice(0, 12));
const activeDecreaseRows = computed(() => changes.value.topActiveDecreases.slice(0, 12));

const marketTotals = computed(() => ({
  impactedStocks: stockImpacts.value.length,
  activeLots: stockImpacts.value.reduce((sum, row) => sum + row.totalActiveDiffLots, 0),
  institutionalNetLots: stockImpacts.value.reduce((sum, row) => sum + (row.institutional?.totalNetShares ?? 0) / 1000, 0),
  turnover: stockImpacts.value.reduce((sum, row) => sum + (row.market?.turnover ?? 0), 0)
}));
const topSectorRows = computed(() => sectorSummaryRows.value.slice(0, 6));
const expandedSectorStocks = computed(() => {
  if (!expandedSector.value) return [];
  return stockImpacts.value
    .filter((row) => sectorLabel(row) === expandedSector.value)
    .sort((a, b) => b.impactScore - a.impactScore);
});
const staleCoverageRows = computed(() =>
  coverage.value?.etfs.filter((etf) => etf.status === "stale" || etf.status === "missing") ?? []
);
const selectedEtfCoverage = computed(
  () => coverage.value?.etfs.find((etf) => etf.etfCode === selectedEtfCode.value) ?? null
);
const selectedEtfLatestDate = computed(() => selectedEtfCoverage.value?.latestTradeDate ?? "-");
const telegramSubscribeUrl = computed(() => telegramInfo.value?.subscribeUrl ?? "https://telegram.org/");
const loadingText = computed(() =>
  hasLoaded.value ? "正在更新資料，畫面先保留上一筆結果。" : "正在載入 ETF 持股、折溢價與跨 ETF 影響資料。"
);
const showInitialSkeleton = computed(() => isLoading.value && !hasLoaded.value);
const helpTexts = {
  impactRanking: "影響分數 = 主動淨變動張數的絕對值，加上權重變動幅度的加權；分數越高代表這檔股票在多檔 ETF 的調倉影響越大。",
  activeLots: "主動淨變動使用規模校正後張數。若 ETF 規模變大，持股自然增加的部分會先扣除。",
  premium: "折溢價 = (收盤股價 - 每單位淨值) / 每單位淨值。正值是溢價，負值是折價。",
  premiumChart: "每一根柱代表一個交易日的折溢價百分比；紅色在零軸上方是溢價，綠色在零軸下方是折價。",
  holdingLots: "持股變動張數 = 今日持股股數與前一個交易日持股股數的差額 / 1000。",
  scaleAdjusted: "排除 ETF 規模變大或變小造成的被動股數變化後，估算經理人主動調倉量。",
  rawLots: "表面張數是不做規模校正的持股張數變化，也就是今日股數減前日股數再除以 1000。",
  adjustedLots: "校正張數會先用 ETF 總受益權單位變化估算應有持股，再用實際持股扣掉應有持股。"
} as const;

function isNewLike(row: Change): boolean {
  return row.status === "new" || (row.prevShares === 0 && row.currentShares > 0);
}

function isExitLike(row: Change): boolean {
  return row.status === "exit" || (row.prevShares > 0 && row.currentShares === 0);
}

const operationRows = computed(() => {
  const rowsByStock = new Map<string, Change>();
  [
    ...changes.value.newHoldings,
    ...changes.value.exitedHoldings,
    ...changes.value.topIncreases,
    ...changes.value.topDecreases
  ].forEach((row) => rowsByStock.set(row.stockId, row));

  const operations = [...rowsByStock.values()]
    .map((row) => {
      if (isNewLike(row)) return { ...row, operationStatus: "new" as const };
      if (isExitLike(row)) return { ...row, operationStatus: "delete" as const };
      if (row.diffShares > 0) return { ...row, operationStatus: "increase" as const };
      if (row.diffShares < 0) return { ...row, operationStatus: "decrease" as const };
      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return operations.sort((a, b) => {
    const order = { new: 0, delete: 1, increase: 2, decrease: 3 };
    if (order[a.operationStatus] !== order[b.operationStatus]) {
      return order[a.operationStatus] - order[b.operationStatus];
    }
    const weightDelta = (b.currentWeight ?? 0) - (a.currentWeight ?? 0);
    if (weightDelta !== 0) return weightDelta;
    return Math.abs(b.diffLots) - Math.abs(a.diffLots);
  });
});

const operationCounts = computed(() => ({
  new: operationRows.value.filter((row) => row.operationStatus === "new").length,
  delete: operationRows.value.filter((row) => row.operationStatus === "delete").length,
  increase: operationRows.value.filter((row) => row.operationStatus === "increase").length,
  decrease: operationRows.value.filter((row) => row.operationStatus === "decrease").length,
  total: operationRows.value.length
}));

const maxActiveLots = computed(() => {
  const magnitudes = [...activeIncreaseRows.value, ...activeDecreaseRows.value].map((row) =>
    Math.abs(row.activeDiffLots ?? 0)
  );
  return Math.max(1, ...magnitudes);
});

function formatNumber(value: NullableNumber, digits = 0): string {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatMoney(value: NullableNumber): string {
  if (value === null) return "-";
  if (Math.abs(value) >= 100_000_000) return `${formatNumber(value / 100_000_000, 2)} 億`;
  if (Math.abs(value) >= 10_000) return `${formatNumber(value / 10_000, 1)} 萬`;
  return formatNumber(value);
}

function formatFundSize(value: NullableNumber): string {
  if (value === null) return "-";
  if (Math.abs(value) >= 100_000_000) {
    return `${new Intl.NumberFormat("zh-TW", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      useGrouping: false
    }).format(value / 100_000_000)} 億`;
  }
  return formatMoney(value);
}

function formatSignedNumber(value: NullableNumber, digits = 0): string {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function formatPct(value: NullableNumber, digits = 2): string {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}%`;
}

function formatPlainPct(value: NullableNumber, digits = 1): string {
  if (value === null) return "-";
  return `${formatNumber(value, digits)}%`;
}

function formatDateLabel(value: string): string {
  return value.slice(5).replace("-", "/");
}

function formatLots(value: NullableNumber): string {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 0)}`;
}

function formatLotsFromShares(value: NullableNumber): string {
  if (value === null) return "-";
  return formatLots(value / 1000);
}

function formatWeight(value: NullableNumber): string {
  if (value === null) return "-";
  return value === 0 ? "<0.01%" : formatPlainPct(value, 2);
}

function operationLabel(status: "new" | "delete" | "increase" | "decrease"): string {
  return {
    new: "新增",
    delete: "刪除",
    increase: "加碼",
    decrease: "減碼"
  }[status];
}

function barWidth(value: NullableNumber): string {
  return `${Math.min(100, (Math.abs(value ?? 0) / maxActiveLots.value) * 100)}%`;
}

function premiumBarStyle(value: NullableNumber): Record<string, string> {
  if (value === null) return { height: "0%" };

  const { min, max } = premiumRange.value;
  const zeroTop = ((max - 0) / (max - min)) * 100;
  const pointTop = ((max - value) / (max - min)) * 100;
  const top = Math.min(zeroTop, pointTop);
  const height = Math.max(2, Math.abs(pointTop - zeroTop));

  return {
    top: `${top}%`,
    height: `${height}%`
  };
}

function premiumZeroStyle(): Record<string, string> {
  const { min, max } = premiumRange.value;
  return {
    top: `${((max - 0) / (max - min)) * 100}%`
  };
}

function etfLabel(code: string): string {
  return etfNameByCode.get(code) ?? code;
}

function coverageStatusLabel(row: EtfCoverageRow): string {
  if (row.status === "missing") return "尚無資料";
  if (row.status === "newer_available") return `最新 ${row.latestTradeDate}`;
  if (row.status === "stale") return `最新 ${row.latestTradeDate}`;
  return "已納入";
}

function marketPriceLabel(row: StockImpact): string {
  if (!row.market) return "-";
  return `${row.market.market} ${formatNumber(row.market.closePrice, 2)}`;
}

function marketChangeClass(row: StockImpact): string {
  const value = row.market?.changePercent ?? 0;
  if (value > 0) return "increase-number";
  if (value < 0) return "decrease-number";
  return "";
}

function marketChangeLabel(row: StockImpact): string {
  if (!row.market) return "-";
  return formatSignedNumber(row.market.changePercent, 2) + "%";
}

function sectorLabel(row: StockImpact): string {
  return row.sector || "其他";
}

function sectorClass(row: StockImpact): string {
  const sector = sectorLabel(row);
  if (sector === "半導體" || sector === "ASIC" || sector === "半導體設備" || sector === "記憶體") return "semiconductor";
  if (sector === "AI Server" || sector === "電源") return "server";
  if (sector === "PCB") return "pcb";
  if (sector === "CPO" || sector === "光通訊") return "optical";
  if (sector === "散熱") return "thermal";
  if (sector === "金融") return "financial";
  if (sector === "航運") return "shipping";
  return "other";
}

function stockImpactRowId(stockId: string): string {
  return `stock-impact-${stockId}`;
}

function toggleSector(sector: string): void {
  expandedSector.value = expandedSector.value === sector ? "" : sector;
}

async function focusStockImpact(stockId: string): Promise<void> {
  marketQuery.value = "";
  focusedStockImpactId.value = stockId;
  await nextTick();

  document.getElementById(stockImpactRowId(stockId))?.scrollIntoView({
    block: "center",
    behavior: "smooth"
  });

  window.setTimeout(() => {
    if (focusedStockImpactId.value === stockId) {
      focusedStockImpactId.value = "";
    }
  }, 2400);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function loadAvailableDates(etfCode = selectedEtfCode.value): Promise<void> {
  const response = await getJson<{ dates: string[] }>(`/api/etf/${etfCode}/dates?limit=180`);
  availableDates.value = response.dates;
  if (!availableDates.value.length) {
    selectedDate.value = "";
    return;
  }

  if (!selectedDate.value || !availableDates.value.includes(selectedDate.value)) {
    selectedDate.value = availableDates.value[0];
  }
}

async function loadDashboard(): Promise<void> {
  if (!selectedDate.value) return;

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const etfCode = selectedEtfCode.value;
    const dashboard = await getJson<DashboardResponse>(
      `/api/dashboard?etfCode=${encodeURIComponent(etfCode)}&date=${selectedDate.value}`
    );

    holdings.value = dashboard.holdings;
    summary.value = dashboard.summary;
    summaryHistory.value = dashboard.summaries;
    stockImpacts.value = dashboard.stockImpact.impacts;
    sectorSummaryRows.value = dashboard.stockImpact.sectorSummary?.sectors ?? [];
    coverage.value = dashboard.coverage;
    changes.value = dashboard.changes;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "資料讀取失敗，請確認 API server 是否啟動。";
  } finally {
    isLoading.value = false;
    hasLoaded.value = true;
  }
}

async function loadTelegramInfo(): Promise<void> {
  try {
    telegramInfo.value = await getJson<TelegramInfo>("/api/telegram/info");
  } catch {
    telegramInfo.value = { configured: false, username: null, subscribeUrl: null };
  }
}

function scrollToPageTop(): void {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

async function showMarketTab(): Promise<void> {
  activeMainTab.value = "market";
  await nextTick();
  scrollToPageTop();
}

async function showEtfReport(etfCode?: string): Promise<void> {
  activeMainTab.value = "etf";
  activeEtfPage.value = "report";

  if (etfCode && etfCode !== selectedEtfCode.value) {
    selectedEtfCode.value = etfCode;
  }

  await nextTick();
  scrollToPageTop();
}

onMounted(() => {
  void (async () => {
    void loadTelegramInfo();
    await loadAvailableDates();
    await loadDashboard();
  })();
});

watch(selectedEtfCode, async (etfCode) => {
  activeEtfPage.value = "report";
  await loadAvailableDates(etfCode);
  await loadDashboard();
  if (activeMainTab.value === "etf") {
    await nextTick();
    scrollToPageTop();
  }
});
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-mark">
          <img src="/assets/logo-mark.svg" alt="" aria-hidden="true" />
        </div>
        <div>
          <h1>台灣主動式ETF 調倉雷達</h1>
          <p>跨 ETF 個股影響、單檔操作日報、折溢價與持股總表</p>
        </div>
      </div>

      <div class="toolbar compact-toolbar">
        <a
          class="telegram-button"
          :class="{ disabled: telegramInfo && !telegramInfo.configured }"
          :href="telegramSubscribeUrl"
          target="_blank"
          rel="noreferrer"
          :aria-disabled="telegramInfo && !telegramInfo.configured"
        >
          <img src="/assets/telegram-icon.svg" alt="" aria-hidden="true" />
          <span>Telegram 訂閱</span>
        </a>

        <label class="control">
          <span><Calendar :size="14" /> 指定日期</span>
          <select v-model="selectedDate" aria-label="指定日期" @change="loadDashboard">
            <option v-for="date in availableDates" :key="date" :value="date">{{ date }}</option>
          </select>
        </label>

        <button class="icon-button" type="button" :disabled="isLoading" aria-label="重新整理" @click="loadDashboard">
          <RefreshCw :size="18" :class="{ spinning: isLoading }" />
        </button>
      </div>
    </header>

    <section v-if="errorMessage" class="alert">
      <AlertCircle :size="18" />
      <span>{{ errorMessage }}</span>
    </section>

    <section v-if="isLoading" class="loading-banner" role="status" aria-live="polite">
      <RefreshCw :size="16" class="spinning" />
      <span>{{ loadingText }}</span>
    </section>

    <section
      id="market-panel"
      v-show="activeMainTab === 'market'"
      class="section-panel market-panel"
      :class="{ 'is-updating': isLoading && hasLoaded }"
      :aria-busy="isLoading"
    >
      <div class="section-heading">
        <div>
          <span class="eyebrow">市場總覽</span>
          <h2><Layers :size="19" /> {{ formatDateLabel(selectedDate) }} 跨 ETF 個股影響總表</h2>
          <p>彙整所有已追蹤統一主動式 ETF 的當日持股異動，先看哪些個股受到最大影響。</p>
        </div>
      </div>

      <div v-if="showInitialSkeleton" class="market-kpis">
        <div v-for="item in 4" :key="`market-skeleton-${item}`" class="kpi skeleton-card">
          <span></span>
          <strong></strong>
          <em></em>
        </div>
      </div>
      <div v-else class="market-kpis">
        <div class="kpi">
          <span>影響個股</span>
          <strong>{{ formatNumber(marketTotals.impactedStocks) }}</strong>
          <em>檔</em>
        </div>
        <div class="kpi">
          <span class="term-with-help">
            主動淨變動
            <button class="help-button" type="button" aria-label="主動淨變動說明">?</button>
            <span class="help-popover" role="tooltip">{{ helpTexts.activeLots }}</span>
          </span>
          <strong>{{ formatLots(marketTotals.activeLots) }}</strong>
          <em>張</em>
        </div>
        <div class="kpi">
          <span>三大法人淨額</span>
          <strong>{{ formatLots(marketTotals.institutionalNetLots) }}</strong>
          <em>張</em>
        </div>
        <div class="kpi">
          <span>成交金額</span>
          <strong>{{ formatMoney(marketTotals.turnover) }}</strong>
          <em>影響股合計</em>
        </div>
      </div>

      <div v-if="topSectorRows.length" class="sector-strip">
        <button
          v-for="row in topSectorRows"
          :key="row.sector"
          class="sector-card"
          :class="{ active: expandedSector === row.sector }"
          type="button"
          :aria-expanded="expandedSector === row.sector"
          @click="toggleSector(row.sector)"
        >
          <b>{{ row.sector }}</b>
          <span :class="{ 'increase-number': row.totalActiveDiffLots > 0, 'decrease-number': row.totalActiveDiffLots < 0 }">
            {{ formatLots(row.totalActiveDiffLots) }} 張
          </span>
          <small>法人 {{ formatLots(row.totalInstitutionalNetLots) }}｜{{ row.stockCount }} 股 / {{ row.etfCount }} ETF</small>
        </button>
      </div>
      <div v-if="expandedSector" class="sector-stock-panel">
        <div class="sector-stock-heading">
          <b>{{ expandedSector }}</b>
          <span>{{ expandedSectorStocks.length }} 檔個股影響資料</span>
        </div>
        <div class="sector-stock-list">
          <button
            v-for="stock in expandedSectorStocks"
            :key="stock.stockId"
            class="sector-stock-link"
            type="button"
            @click="focusStockImpact(stock.stockId)"
          >
            <b>{{ stock.stockId }}</b>
            <span>{{ stock.stockName }}</span>
            <small :class="{ 'increase-number': stock.totalActiveDiffLots > 0, 'decrease-number': stock.totalActiveDiffLots < 0 }">
              {{ formatLots(stock.totalActiveDiffLots) }} 張
            </small>
          </button>
        </div>
      </div>

      <div v-if="coverage" class="coverage-strip">
        <div class="coverage-main">
          <b>統計涵蓋 {{ coverage.availableCount }} / {{ coverage.trackedCount }} 檔 ETF</b>
          <span>{{ selectedDate }} 已納入跨 ETF 影響計算；不同投信揭露時間可能不同。</span>
        </div>
        <div v-if="staleCoverageRows.length" class="coverage-lag">
          <span>尚未更新</span>
          <small v-for="row in staleCoverageRows.slice(0, 6)" :key="row.etfCode">
            {{ row.etfCode }} {{ coverageStatusLabel(row) }}
          </small>
          <small v-if="staleCoverageRows.length > 6">+{{ staleCoverageRows.length - 6 }} 檔</small>
        </div>
        <div v-else class="coverage-lag complete">
          <span>所有追蹤 ETF 都已含此日期資料</span>
        </div>
      </div>

      <div class="table-title">
        <div>
          <h2>
            <BarChart3 :size="18" /> 個股影響排名
            <span class="term-with-help">
              <button class="help-button" type="button" aria-label="個股影響排名說明">?</button>
              <span class="help-popover" role="tooltip">{{ helpTexts.impactRanking }}</span>
            </span>
          </h2>
          <p>依影響分數排序，共 {{ displayedImpacts.length }} 檔</p>
        </div>
        <label class="search-box">
          <Search :size="16" />
          <input v-model="marketQuery" type="search" placeholder="搜尋股票代號、名稱或 ETF" />
        </label>
      </div>

      <div class="holdings-table impact-table">
        <div class="holdings-head">
          <span>股票</span>
          <span>產業 / 行情</span>
          <span class="term-with-help">
            主動淨變動
            <button class="help-button" type="button" aria-label="主動淨變動說明">?</button>
            <span class="help-popover" role="tooltip">{{ helpTexts.activeLots }}</span>
          </span>
          <span>權重變動</span>
          <span>三大法人</span>
          <span>成交金額</span>
          <span>影響 ETF</span>
          <span>主要來源</span>
        </div>
        <template v-if="showInitialSkeleton">
          <div v-for="item in 5" :key="`impact-row-skeleton-${item}`" class="holding-row skeleton-row">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </template>
        <div
          v-for="row in displayedImpacts"
          v-else
          :id="stockImpactRowId(row.stockId)"
          :key="row.stockId"
          class="holding-row"
          :class="{ 'is-focused': focusedStockImpactId === row.stockId }"
        >
          <span class="stock-cell">
            <b>{{ row.stockId }}</b>
            <span>{{ row.stockName }}</span>
          </span>
          <span class="sector-market-cell">
            <b class="sector-pill" :class="sectorClass(row)">{{ sectorLabel(row) }}</b>
            <small class="market-price-line">{{ marketPriceLabel(row) }}</small>
            <small class="market-change-line" :class="marketChangeClass(row)">{{ marketChangeLabel(row) }}</small>
          </span>
          <span :class="{ 'increase-number': row.totalActiveDiffLots > 0, 'decrease-number': row.totalActiveDiffLots < 0 }">
            {{ formatLots(row.totalActiveDiffLots) }}
          </span>
          <span :class="{ 'increase-number': row.totalDiffWeightPoint > 0, 'decrease-number': row.totalDiffWeightPoint < 0 }">
            {{ formatPct(row.totalDiffWeightPoint, 2) }}
          </span>
          <span :class="{ 'increase-number': (row.institutional?.totalNetShares ?? 0) > 0, 'decrease-number': (row.institutional?.totalNetShares ?? 0) < 0 }">
            {{ formatLotsFromShares(row.institutional?.totalNetShares ?? null) }}
            <small class="impact-split">投信 {{ formatLotsFromShares(row.institutional?.investmentTrustNetShares ?? null) }}</small>
          </span>
          <span>
            {{ formatMoney(row.market?.turnover ?? null) }}
            <small class="impact-split">{{ formatLotsFromShares(row.market?.volumeShares ?? null) }} 張</small>
          </span>
          <span>
            {{ row.etfCount }} 檔
            <small class="impact-split">加 {{ row.increaseEtfCount }} / 減 {{ row.decreaseEtfCount }}</small>
          </span>
          <span>
            <button
              v-if="row.primaryImpactEtf"
              class="primary-etf-link"
              type="button"
              @click="showEtfReport(row.primaryImpactEtf.etfCode)"
            >
              {{ row.primaryImpactEtf.etfCode }}
            </button>
            <span v-else>-</span>
            <small class="impact-split">{{ row.primaryImpactEtf ? etfLabel(row.primaryImpactEtf.etfCode) : "-" }}</small>
          </span>
        </div>
        <p v-if="!isLoading && !displayedImpacts.length" class="empty-row">此日期尚無跨 ETF 異動資料。</p>
      </div>

      <AdSlot
        v-if="activeMainTab === 'market'"
        slot="article-inline"
        page="/market"
      />
    </section>

    <section
      id="report-panel"
      v-show="activeMainTab === 'etf'"
      class="section-panel report-panel"
      :class="{ 'is-updating': isLoading && hasLoaded }"
      :aria-busy="isLoading"
    >
      <div class="section-heading report-heading">
        <div>
          <span class="eyebrow">單檔 ETF</span>
          <h2 v-if="activeEtfPage === 'report'"><ListChecks :size="19" /> 操作日報</h2>
          <h2 v-else><LineChart :size="19" /> 折溢價歷史</h2>
          <p v-if="activeEtfPage === 'report'">基金選擇、當日增減碼、折溢價與持股總表都集中在這裡。</p>
          <p v-else>查看 {{ selectedEtf?.etfCode }} 的歷史股價、淨值與折溢價走勢。</p>
        </div>
        <div class="toolbar report-controls">
          <button
            v-if="activeEtfPage === 'premiumHistory'"
            class="secondary-button"
            type="button"
            @click="activeEtfPage = 'report'"
          >
            返回日報
          </button>
          <label class="control wide-control">
            <span>ETF</span>
            <select v-model="selectedEtfCode" aria-label="ETF">
              <option v-for="etf in etfOptions" :key="etf.etfCode" :value="etf.etfCode">
                {{ etf.etfCode }} {{ etf.name }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <div class="report-identity">
        <b>{{ selectedEtf?.etfCode }}</b>
        <span>{{ selectedEtf?.name }}</span>
        <small>
          {{ selectedEtf?.issuer }}｜畫面日期 {{ selectedDate }}｜來源最新 {{ selectedEtfLatestDate }}
        </small>
      </div>

      <template v-if="activeEtfPage === 'report'">
        <section v-if="showInitialSkeleton" class="summary-cards" aria-label="ETF summary loading">
          <div v-for="item in 3" :key="`summary-skeleton-${item}`" class="kpi skeleton-card">
            <span></span>
            <strong></strong>
            <em></em>
          </div>
        </section>
        <section v-else class="summary-cards" aria-label="ETF summary">
          <div class="kpi">
            <span>基金規模</span>
            <strong>{{ formatFundSize(summary?.fundSize ?? null) }}</strong>
            <em>較前日 {{ formatPct(summary?.netCreationUnits ? (summary.netCreationUnits / (summary.totalUnits ?? 1)) * 100 : 0, 2) }}</em>
          </div>
          <div class="kpi premium-kpi">
            <span class="term-with-help">
              折溢價 / NAV
              <button class="help-button" type="button" aria-label="折溢價說明">?</button>
              <span class="help-popover" role="tooltip">{{ helpTexts.premium }}</span>
            </span>
            <strong>{{ formatPct(summary?.premiumDiscount ?? null, 2) }}</strong>
            <em>股價 {{ formatNumber(summary?.marketPrice ?? null, 2) }}｜淨值 {{ formatNumber(summary?.nav ?? null, 2) }}</em>
            <button class="kpi-action" type="button" @click="activeEtfPage = 'premiumHistory'">
              <LineChart :size="16" />
              歷史
            </button>
          </div>
          <div class="kpi">
            <span>資產配置</span>
            <strong>{{ formatPct(summary?.stockRatio ?? null, 1) }}</strong>
            <em>股票｜現金 {{ formatPct(summary?.cashRatio ?? null, 1) }}</em>
          </div>
        </section>

        <section v-if="showInitialSkeleton" class="operation-cards">
          <div v-for="item in 4" :key="`operation-skeleton-${item}`" class="kpi skeleton-card">
            <span></span>
            <strong></strong>
            <em></em>
          </div>
        </section>
        <section v-else class="operation-cards">
          <div class="kpi">
            <span>新增</span>
            <strong>{{ operationCounts.new }}</strong>
            <em>檔</em>
          </div>
          <div class="kpi delete-card">
            <span>刪除</span>
            <strong>{{ operationCounts.delete }}</strong>
            <em>檔</em>
          </div>
          <div class="kpi add-card">
            <span>加碼</span>
            <strong>{{ operationCounts.increase }}</strong>
            <em>檔</em>
          </div>
          <div class="kpi cut-card">
            <span>減碼</span>
            <strong>{{ operationCounts.decrease }}</strong>
            <em>檔</em>
          </div>
        </section>
      </template>

      <section v-else class="premium-history-page">
        <div class="premium-page-title">
          <div>
            <h2>
              <LineChart :size="18" /> 折溢價走勢（橫軸：交易日）
              <span class="term-with-help">
                <button class="help-button" type="button" aria-label="折溢價走勢說明">?</button>
                <span class="help-popover" role="tooltip">{{ helpTexts.premiumChart }}</span>
              </span>
            </h2>
            <p>更新：{{ latestPremiumDate === "-" ? "-" : formatDateLabel(latestPremiumDate) }}</p>
          </div>
        </div>

        <div class="premium-chart" :class="{ empty: !premiumValues.length }">
          <div v-if="premiumValues.length" class="premium-bars">
            <div class="premium-zero" :style="premiumZeroStyle()"></div>
            <div v-for="row in premiumChartRows" :key="row.tradeDate" class="premium-bar-slot">
              <span
                class="premium-bar"
                :class="{ positive: (row.premiumDiscount ?? 0) >= 0, negative: (row.premiumDiscount ?? 0) < 0 }"
                :style="premiumBarStyle(row.premiumDiscount)"
                :title="`${formatDateLabel(row.tradeDate)} ${formatPct(row.premiumDiscount, 2)}`"
              ></span>
            </div>
          </div>
          <div v-if="premiumValues.length" class="premium-axis">
            <span>{{ premiumChartRows[0] ? formatDateLabel(premiumChartRows[0].tradeDate) : "-" }}</span>
            <span>交易日</span>
            <span>{{ premiumChartRows[premiumChartRows.length - 1] ? formatDateLabel(premiumChartRows[premiumChartRows.length - 1].tradeDate) : "-" }}</span>
          </div>
          <p v-if="!premiumValues.length">目前已保存 NAV 歷史，但尚未同步市價，因此折溢價待補。</p>
        </div>

        <div class="premium-table">
          <div class="premium-head">
            <span>日期</span>
            <span>股價</span>
            <span>淨值</span>
            <span class="term-with-help">
              折溢價
              <button class="help-button" type="button" aria-label="折溢價說明">?</button>
              <span class="help-popover" role="tooltip">{{ helpTexts.premium }}</span>
            </span>
          </div>
          <div v-for="row in premiumRows" :key="row.tradeDate" class="premium-row">
            <span>{{ formatDateLabel(row.tradeDate) }}</span>
            <span>{{ formatNumber(row.marketPrice, 2) }}</span>
            <span>{{ formatNumber(row.nav, 2) }}</span>
            <span :class="{ 'increase-number': (row.premiumDiscount ?? 0) > 0, 'decrease-number': (row.premiumDiscount ?? 0) < 0 }">
              {{ formatPct(row.premiumDiscount, 2) }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="activeEtfPage === 'report'" class="operation-panel">
        <div class="operation-title">
          <div>
            <h2><ListChecks :size="18" /> 共 {{ operationCounts.total }} 檔異動</h2>
          </div>
          <span class="term-with-help">
            規模校正後主動訊號
            <button class="help-button" type="button" aria-label="規模校正後主動訊號說明">?</button>
            <span class="help-popover align-right" role="tooltip">{{ helpTexts.scaleAdjusted }}</span>
          </span>
        </div>

        <div class="operation-table">
          <div class="operation-head">
            <span>標的</span>
            <span>狀態</span>
            <span class="term-with-help">
              持股變動<br />張數
              <button class="help-button" type="button" aria-label="持股變動張數說明">?</button>
              <span class="help-popover" role="tooltip">{{ helpTexts.holdingLots }}</span>
            </span>
            <span>變動幅度</span>
            <span>目前權重<br />變動%</span>
          </div>
          <template v-if="showInitialSkeleton">
            <div v-for="item in 5" :key="`operation-row-skeleton-${item}`" class="operation-row skeleton-row">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </template>
          <div v-for="row in operationRows" v-else :key="`${row.operationStatus}-${row.stockId}`" class="operation-row">
            <span class="operation-stock">
              <b>{{ row.stockName }}</b>
              <small>{{ row.stockId }}</small>
            </span>
            <span class="status-pill" :class="row.operationStatus">{{ operationLabel(row.operationStatus) }}</span>
            <span :class="['operation-number', row.operationStatus]">{{ formatLots(row.diffLots) }}</span>
            <span>{{ formatPlainPct(row.diffPct, 1) }}</span>
            <span class="weight-stack">
              <b>{{ formatWeight(row.currentWeight) }}</b>
              <small>{{ formatPct(row.diffWeightPoint, 2) }}</small>
            </span>
          </div>
          <p v-if="!isLoading && !operationRows.length" class="empty-row">此日期尚無可計算的異動資料。</p>
        </div>
      </section>

      <section v-if="activeEtfPage === 'report'" class="signal-grid">
        <article class="panel">
          <div class="panel-title positive">
            <TrendingUp :size="18" />
            <h2>
              規模校正加碼
              <span class="term-with-help">
                <button class="help-button" type="button" aria-label="規模校正加碼說明">?</button>
                <span class="help-popover" role="tooltip">{{ helpTexts.scaleAdjusted }}</span>
              </span>
            </h2>
          </div>
          <div class="signal-table">
            <div class="signal-head">
              <span>股票</span>
              <span class="term-with-help">
                表面張數<br />張
                <button class="help-button" type="button" aria-label="表面張數說明">?</button>
                <span class="help-popover" role="tooltip">{{ helpTexts.rawLots }}</span>
              </span>
              <span class="term-with-help">
                校正張數<br />張
                <button class="help-button" type="button" aria-label="校正張數說明">?</button>
                <span class="help-popover" role="tooltip">{{ helpTexts.adjustedLots }}</span>
              </span>
              <span>比例</span>
              <span>權重</span>
              <span>分數</span>
            </div>
            <div v-for="row in activeIncreaseRows" :key="row.stockId" class="signal-row">
              <span class="stock-cell"><b>{{ row.stockId }}</b>{{ row.stockName }}</span>
              <span>{{ formatLots(row.diffLots) }}</span>
              <span class="increase-number">{{ formatLots(row.activeDiffLots) }}</span>
              <span>{{ formatPct(row.activeDiffPct) }}</span>
              <span>{{ formatPct(row.diffWeightPoint) }}</span>
              <span class="score">{{ row.activeSignalScore ?? "-" }}</span>
              <div class="magnitude positive-bg" :style="{ width: barWidth(row.activeDiffLots) }"></div>
            </div>
            <p v-if="!activeIncreaseRows.length" class="empty-row">此日沒有符合門檻的主動加碼。</p>
          </div>
        </article>

        <article class="panel">
          <div class="panel-title negative">
            <TrendingDown :size="18" />
            <h2>
              規模校正減碼
              <span class="term-with-help">
                <button class="help-button" type="button" aria-label="規模校正減碼說明">?</button>
                <span class="help-popover" role="tooltip">{{ helpTexts.scaleAdjusted }}</span>
              </span>
            </h2>
          </div>
          <div class="signal-table">
            <div class="signal-head">
              <span>股票</span>
              <span class="term-with-help">
                表面張數<br />張
                <button class="help-button" type="button" aria-label="表面張數說明">?</button>
                <span class="help-popover" role="tooltip">{{ helpTexts.rawLots }}</span>
              </span>
              <span class="term-with-help">
                校正張數<br />張
                <button class="help-button" type="button" aria-label="校正張數說明">?</button>
                <span class="help-popover" role="tooltip">{{ helpTexts.adjustedLots }}</span>
              </span>
              <span>比例</span>
              <span>權重</span>
              <span>分數</span>
            </div>
            <div v-for="row in activeDecreaseRows" :key="row.stockId" class="signal-row">
              <span class="stock-cell"><b>{{ row.stockId }}</b>{{ row.stockName }}</span>
              <span>{{ formatLots(row.diffLots) }}</span>
              <span class="decrease-number">{{ formatLots(row.activeDiffLots) }}</span>
              <span>{{ formatPct(row.activeDiffPct) }}</span>
              <span>{{ formatPct(row.diffWeightPoint) }}</span>
              <span class="score">{{ row.activeSignalScore ?? "-" }}</span>
              <div class="magnitude negative-bg" :style="{ width: barWidth(row.activeDiffLots) }"></div>
            </div>
            <p v-if="!activeDecreaseRows.length" class="empty-row">此日沒有符合門檻的主動減碼。</p>
          </div>
        </article>
      </section>

      <section v-if="activeEtfPage === 'report'" class="holdings-panel">
        <div class="table-title">
          <div>
            <h2><Database :size="18" /> 持股總表</h2>
            <p>{{ selectedDate }}，{{ selectedEtf?.etfCode }} 共 {{ displayedHoldings.length }} 檔</p>
          </div>
          <label class="search-box">
            <Search :size="16" />
            <input v-model="holdingQuery" type="search" placeholder="搜尋股票代號或名稱" />
          </label>
        </div>

        <div class="holdings-table">
          <div class="holdings-head">
            <span>股票</span>
            <span>持股張數</span>
            <span>市值</span>
            <span>目前權重</span>
            <span>股數</span>
          </div>
          <template v-if="showInitialSkeleton">
            <div v-for="item in 8" :key="`holding-row-skeleton-${item}`" class="holding-row skeleton-row">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </template>
          <div v-for="row in displayedHoldings" v-else :key="row.stockId" class="holding-row">
            <span class="stock-cell"><b>{{ row.stockId }}</b>{{ row.stockName }}</span>
            <span>{{ formatNumber(row.lots, 0) }}</span>
            <span>{{ formatMoney(row.marketValue) }}</span>
            <span>{{ formatWeight(row.weight) }}</span>
            <span>{{ formatNumber(row.shares, 0) }}</span>
          </div>
          <p v-if="!isLoading && !displayedHoldings.length" class="empty-row">此日期尚無持股資料。</p>
        </div>
      </section>

      <AdSlot
        v-if="activeMainTab === 'etf' && activeEtfPage === 'report'"
        slot="article-inline"
        :page="`/etf/${selectedEtfCode}`"
        :etf-code="selectedEtfCode"
      />
    </section>

    <footer class="disclaimer">
      本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。ETF 持股揭露可能有時間差，請以投信與交易所公告為準。
    </footer>

    <nav class="bottom-tabs" aria-label="主要頁籤">
      <button
        type="button"
        :class="{ active: activeMainTab === 'market' }"
        aria-controls="market-panel"
        @click="showMarketTab"
      >
        <Layers :size="19" />
        <span>市場總覽</span>
      </button>
      <button
        type="button"
        :class="{ active: activeMainTab === 'etf' }"
        aria-controls="report-panel"
        @click="showEtfReport()"
      >
        <ListChecks :size="19" />
        <span>單檔 ETF</span>
      </button>
    </nav>
  </main>
</template>
