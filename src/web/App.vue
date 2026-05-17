<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Activity,
  AlertCircle,
  Calendar,
  Database,
  Info,
  ListChecks,
  LineChart,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp
} from "@lucide/vue";

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
const etfCode = "00981A";
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
const activeView = ref<"operations" | "holdings" | "premium">("operations");
const query = ref("");
const isLoading = ref(false);
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

const displayedHoldings = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  if (!normalized) return stockImpacts.value;

  return stockImpacts.value.filter((row) =>
    `${row.stockId} ${row.stockName} ${row.primaryImpactEtf?.etfCode ?? ""}`.toLowerCase().includes(normalized)
  );
});

const premiumRows = computed(() =>
  [...summaryHistory.value].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
);

const premiumValues = computed(() =>
  premiumRows.value
    .map((row) => row.premiumDiscount)
    .filter((value): value is number => value !== null && !Number.isNaN(value))
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
  if (value === null) return { width: "0%" };

  const { min, max } = premiumRange.value;
  const zero = ((0 - min) / (max - min)) * 100;
  const point = ((value - min) / (max - min)) * 100;
  const left = Math.min(zero, point);
  const width = Math.max(2, Math.abs(point - zero));

  return {
    left: `${left}%`,
    width: `${width}%`
  };
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
    const [holdingsResponse, summaryResponse, changesResponse, summaryHistoryResponse, stockImpactResponse] = await Promise.all([
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
          <p>公開 PCF 持股資料、每日增減碼與規模校正後主動訊號</p>
        </div>
      </div>

      <div class="toolbar">
        <label class="control">
          <span>ETF</span>
          <select aria-label="ETF">
            <option>00981A 主動統一台股增長</option>
          </select>
        </label>

        <label class="control">
          <span><Calendar :size="14" /> 日期</span>
          <select v-model="selectedDate" aria-label="日期" @change="loadDashboard">
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

    <section class="daily-heading">
      <div>
        <h2>{{ selectedDate.slice(5).replace("-", "/") }} 操作日報</h2>
        <p>以官方 PCF 持股揭露計算，並校正 ETF 規模變化。</p>
      </div>
      <button class="text-button" type="button">
        變動說明 <Info :size="15" />
      </button>
    </section>

    <nav class="view-tabs" aria-label="資料頁籤">
      <button type="button" :class="{ active: activeView === 'operations' }" @click="activeView = 'operations'">
        操作日報
      </button>
      <button type="button" :class="{ active: activeView === 'holdings' }" @click="activeView = 'holdings'">
        總清單
      </button>
      <button type="button" :class="{ active: activeView === 'premium' }" @click="activeView = 'premium'">
        折溢價
      </button>
    </nav>

    <section v-if="activeView === 'operations'" class="summary-cards" aria-label="ETF summary">
      <div class="kpi">
        <span>基金規模</span>
        <strong>{{ formatFundSize(summary?.fundSize ?? null) }}</strong>
        <em>較前日 {{ formatPct(summary?.netCreationUnits ? (summary.netCreationUnits / (summary.totalUnits ?? 1)) * 100 : 0, 2) }}</em>
      </div>
      <div class="kpi">
        <span>NAV</span>
        <strong>{{ formatNumber(summary?.nav ?? null, 2) }}</strong>
        <em>股票 {{ formatPct(summary?.stockRatio ?? null, 2) }}｜現金 {{ formatPct(summary?.cashRatio ?? null, 2) }}</em>
      </div>
    </section>

    <section v-if="activeView === 'operations'" class="operation-cards">
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

    <section v-if="activeView === 'operations'" class="operation-panel">
      <div class="operation-title">
        <div>
          <h2><ListChecks :size="18" /> 共 {{ operationCounts.total }} 檔異動</h2>
        </div>
        <span>變動說明 <Info :size="15" /></span>
      </div>

      <div class="operation-table">
        <div class="operation-head">
          <span>標的</span>
          <span>狀態</span>
          <span>持股變動</span>
          <span>變動幅度</span>
          <span>目前權重<br />變動%</span>
        </div>
        <div v-for="row in operationRows" :key="`${row.operationStatus}-${row.stockId}`" class="operation-row">
          <span class="operation-stock">
            <b>{{ row.stockName }}</b>
            <small>{{ row.stockId }}</small>
          </span>
          <span class="status-pill" :class="row.operationStatus">{{ operationLabel(row.operationStatus) }}</span>
          <span :class="['operation-number', row.operationStatus]">{{ formatLots(row.diffLots) }}</span>
          <span>{{ formatPlainPct(row.diffPct, 1) }}</span>
          <span class="weight-stack">
            <b>{{ row.currentWeight === null || row.currentWeight === 0 ? "<0.01%" : formatPlainPct(row.currentWeight, 2) }}</b>
            <small>{{ formatPct(row.diffWeightPoint, 2) }}</small>
          </span>
        </div>
      </div>
    </section>

    <section v-if="activeView === 'operations'" class="signal-grid">
      <article class="panel">
        <div class="panel-title positive">
          <TrendingUp :size="18" />
          <h2>真正主動加碼</h2>
        </div>
        <div class="signal-table">
          <div class="signal-head">
            <span>股票</span>
            <span>表面張數</span>
            <span>主動張數</span>
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
          <h2>真正主動減碼</h2>
        </div>
        <div class="signal-table">
          <div class="signal-head">
            <span>股票</span>
            <span>表面張數</span>
            <span>主動張數</span>
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

    <section v-if="activeView === 'operations'" class="list-strip">
      <article class="list-panel">
        <h2>新增持股</h2>
        <div class="tag-list">
          <span v-for="row in changes.newHoldings" :key="row.stockId" class="tag">{{ row.stockId }} {{ row.stockName }}</span>
          <span v-if="!changes.newHoldings.length" class="muted">無</span>
        </div>
      </article>
      <article class="list-panel">
        <h2>清倉持股</h2>
        <div class="tag-list">
          <span v-for="row in changes.exitedHoldings" :key="row.stockId" class="tag danger">{{ row.stockId }} {{ row.stockName }}</span>
          <span v-if="!changes.exitedHoldings.length" class="muted">無</span>
        </div>
      </article>
    </section>

    <section v-if="activeView === 'holdings'" class="summary-cards holdings-overview" aria-label="Holdings overview">
      <div class="kpi">
        <span>影響個股</span>
        <strong>{{ formatNumber(stockImpacts.length) }}</strong>
        <em>檔，依跨 ETF 影響排序</em>
      </div>
      <div class="kpi">
        <span>主動淨變動</span>
        <strong>{{ formatLots(stockImpacts.reduce((sum, row) => sum + row.totalActiveDiffLots, 0)) }}</strong>
        <em>張，跨所有追蹤 ETF</em>
      </div>
    </section>

    <section v-if="activeView === 'premium'" class="premium-panel">
      <div class="table-title">
        <div>
          <h2><LineChart :size="18" /> 折溢價歷史</h2>
          <p>更新：{{ latestPremiumDate === "-" ? "-" : formatDateLabel(latestPremiumDate) }}</p>
        </div>
      </div>

      <div class="premium-chart" :class="{ empty: !premiumValues.length }">
        <div class="premium-zero"></div>
        <div
          v-for="row in premiumRows.slice().reverse()"
          :key="row.tradeDate"
          v-show="row.premiumDiscount !== null"
          class="premium-bar"
          :class="{ positive: (row.premiumDiscount ?? 0) >= 0, negative: (row.premiumDiscount ?? 0) < 0 }"
          :style="premiumBarStyle(row.premiumDiscount)"
          :title="`${formatDateLabel(row.tradeDate)} ${formatPct(row.premiumDiscount, 2)}`"
        ></div>
        <p v-if="!premiumValues.length">目前已保存 NAV 歷史，但尚未同步市價，因此折溢價待補。</p>
      </div>

      <div class="premium-table">
        <div class="premium-head">
          <span>日期</span>
          <span>股價</span>
          <span>淨值</span>
          <span>折溢價</span>
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

    <section v-if="activeView === 'holdings'" class="holdings-panel">
      <div class="table-title">
        <div>
          <h2><Database :size="18" /> 個股影響總表</h2>
          <p>{{ selectedDate }}，共 {{ displayedHoldings.length }} 檔受影響個股</p>
        </div>
        <label class="search-box">
          <Search :size="16" />
          <input v-model="query" type="search" placeholder="搜尋股票代號、名稱或 ETF" />
        </label>
      </div>

      <div class="holdings-table">
        <div class="holdings-head">
          <span>股票</span>
          <span>主動淨變動</span>
          <span>權重變動</span>
          <span>影響 ETF</span>
          <span>主要來源</span>
        </div>
        <div v-for="row in displayedHoldings" :key="row.stockId" class="holding-row">
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
            <small class="impact-split">{{ formatLots(row.primaryImpactEtf?.activeDiffLots ?? row.primaryImpactEtf?.diffLots ?? null) }}</small>
          </span>
        </div>
      </div>
    </section>

    <footer class="disclaimer">
      本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。ETF 持股揭露可能有時間差，請以投信與交易所公告為準。
    </footer>
  </main>
</template>
