<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Activity,
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

type NullableNumber = number | null;

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
  etfCount: number;
  increaseEtfCount: number;
  decreaseEtfCount: number;
  totalDiffLots: number;
  totalActiveDiffLots: number;
  totalDiffWeightPoint: number;
  maxAbsActiveDiffLots: number;
  maxAbsDiffWeightPoint: number;
  impactScore: number;
  primaryImpactEtf: StockImpactEtf | null;
  etfs: StockImpactEtf[];
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:7072" : "");
const etfOptions = configuredEtfs.filter((etf) => etf.enabled);
const etfNameByCode = new Map(etfOptions.map((etf) => [etf.etfCode, etf.name]));
const availableDates = [
  "2026-05-15",
  "2026-05-14",
  "2026-05-13",
  "2026-05-12",
  "2026-05-11",
  "2026-05-08",
  "2026-05-07"
];

const selectedDate = ref("2026-05-15");
const selectedEtfCode = ref(etfOptions[0]?.etfCode ?? "00981A");
const marketQuery = ref("");
const holdingQuery = ref("");
const isLoading = ref(false);
const hasLoaded = ref(false);
const errorMessage = ref("");
const holdings = ref<Holding[]>([]);
const summary = ref<Summary | null>(null);
const summaryHistory = ref<Summary[]>([]);
const stockImpacts = ref<StockImpact[]>([]);
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
    `${row.stockId} ${row.stockName} ${row.etfs.map((etf) => etf.etfCode).join(" ")}`.toLowerCase().includes(normalized)
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
  etfTouches: stockImpacts.value.reduce((sum, row) => sum + row.etfCount, 0)
}));
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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function loadDashboard(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const etfCode = selectedEtfCode.value;
    const [holdingsResponse, summaryResponse, changesResponse, summaryHistoryResponse, stockImpactResponse] =
      await Promise.all([
        getJson<{ holdings: Holding[] }>(`/api/etf/${etfCode}/holdings?date=${selectedDate.value}`),
        getJson<{ summary: Summary | null }>(`/api/etf/${etfCode}/summary?date=${selectedDate.value}`),
        getJson<ChangesResponse>(`/api/etf/${etfCode}/changes?date=${selectedDate.value}`),
        getJson<{ summaries: Summary[] }>(`/api/etf/${etfCode}/summary-history?limit=90`),
        getJson<{ impacts: StockImpact[] }>(`/api/market/stock-impact?date=${selectedDate.value}`)
      ]);

    holdings.value = holdingsResponse.holdings;
    summary.value = summaryResponse.summary;
    summaryHistory.value = summaryHistoryResponse.summaries;
    stockImpacts.value = stockImpactResponse.impacts;
    changes.value = changesResponse;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "資料讀取失敗，請確認 API server 是否啟動。";
  } finally {
    isLoading.value = false;
    hasLoaded.value = true;
  }
}

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-mark"><Activity :size="20" /></div>
        <div>
          <h1>台灣主動式ETF 調倉雷達</h1>
          <p>跨 ETF 個股影響、單檔操作日報、折溢價與持股總表</p>
        </div>
      </div>

      <div class="toolbar compact-toolbar">
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

    <section class="section-panel market-panel" :class="{ 'is-updating': isLoading && hasLoaded }" :aria-busy="isLoading">
      <div class="section-heading">
        <div>
          <span class="eyebrow">市場總覽</span>
          <h2><Layers :size="19" /> {{ formatDateLabel(selectedDate) }} 跨 ETF 個股影響總表</h2>
          <p>彙整所有已追蹤統一主動式 ETF 的當日持股異動，先看哪些個股受到最大影響。</p>
        </div>
      </div>

      <div v-if="showInitialSkeleton" class="market-kpis">
        <div v-for="item in 3" :key="`market-skeleton-${item}`" class="kpi skeleton-card">
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
          <span>ETF 異動交集</span>
          <strong>{{ formatNumber(marketTotals.etfTouches) }}</strong>
          <em>筆</em>
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
          <span class="term-with-help">
            主動淨變動
            <button class="help-button" type="button" aria-label="主動淨變動說明">?</button>
            <span class="help-popover" role="tooltip">{{ helpTexts.activeLots }}</span>
          </span>
          <span>權重變動</span>
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
          </div>
        </template>
        <div v-for="row in displayedImpacts" v-else :key="row.stockId" class="holding-row">
          <span class="stock-cell"><b>{{ row.stockId }}</b>{{ row.stockName }}</span>
          <span :class="{ 'increase-number': row.totalActiveDiffLots > 0, 'decrease-number': row.totalActiveDiffLots < 0 }">
            {{ formatLots(row.totalActiveDiffLots) }}
          </span>
          <span :class="{ 'increase-number': row.totalDiffWeightPoint > 0, 'decrease-number': row.totalDiffWeightPoint < 0 }">
            {{ formatPct(row.totalDiffWeightPoint, 2) }}
          </span>
          <span>
            {{ row.etfCount }} 檔
            <small class="impact-split">加 {{ row.increaseEtfCount }} / 減 {{ row.decreaseEtfCount }}</small>
          </span>
          <span>
            {{ row.primaryImpactEtf?.etfCode ?? "-" }}
            <small class="impact-split">{{ row.primaryImpactEtf ? etfLabel(row.primaryImpactEtf.etfCode) : "-" }}</small>
          </span>
        </div>
        <p v-if="!isLoading && !displayedImpacts.length" class="empty-row">此日期尚無跨 ETF 異動資料。</p>
      </div>
    </section>

    <section class="section-panel report-panel" :class="{ 'is-updating': isLoading && hasLoaded }" :aria-busy="isLoading">
      <div class="section-heading report-heading">
        <div>
          <span class="eyebrow">單檔 ETF</span>
          <h2><ListChecks :size="19" /> 操作日報</h2>
          <p>基金選擇、當日增減碼、折溢價與持股總表都集中在這裡。</p>
        </div>
        <div class="toolbar report-controls">
          <label class="control wide-control">
            <span>ETF</span>
            <select v-model="selectedEtfCode" aria-label="ETF" @change="loadDashboard">
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
        <small>{{ selectedEtf?.issuer }}｜{{ selectedDate }}</small>
      </div>

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
        <div class="kpi">
          <span class="term-with-help">
            折溢價 / NAV
            <button class="help-button" type="button" aria-label="折溢價說明">?</button>
            <span class="help-popover" role="tooltip">{{ helpTexts.premium }}</span>
          </span>
          <strong>{{ formatPct(summary?.premiumDiscount ?? null, 2) }}</strong>
          <em>股價 {{ formatNumber(summary?.marketPrice ?? null, 2) }}｜淨值 {{ formatNumber(summary?.nav ?? null, 2) }}</em>
        </div>
        <div class="kpi">
          <span>資產配置</span>
          <strong>{{ formatPct(summary?.stockRatio ?? null, 1) }}</strong>
          <em>股票｜現金 {{ formatPct(summary?.cashRatio ?? null, 1) }}</em>
        </div>
      </section>

      <details class="history-disclosure premium-disclosure" open>
        <summary>
          <span>
            <LineChart :size="18" /> 折溢價走勢（橫軸：交易日）
            <span class="term-with-help">
              <button class="help-button" type="button" aria-label="折溢價走勢說明">?</button>
              <span class="help-popover" role="tooltip">{{ helpTexts.premiumChart }}</span>
            </span>
          </span>
          <small>更新：{{ latestPremiumDate === "-" ? "-" : formatDateLabel(latestPremiumDate) }}</small>
        </summary>

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
      </details>

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

      <section class="operation-panel">
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

      <section class="signal-grid">
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

      <section class="holdings-panel">
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
    </section>

    <footer class="disclaimer">
      本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。ETF 持股揭露可能有時間差，請以投信與交易所公告為準。
    </footer>
  </main>
</template>
