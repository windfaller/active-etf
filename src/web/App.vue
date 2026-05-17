<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Activity,
  AlertCircle,
  Calendar,
  Database,
  Info,
  ListChecks,
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
const query = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const holdings = ref<Holding[]>([]);
const summary = ref<Summary | null>(null);
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
  if (!normalized) return holdings.value;

  return holdings.value.filter((holding) =>
    `${holding.stockId} ${holding.stockName}`.toLowerCase().includes(normalized)
  );
});

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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function loadDashboard(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const [holdingsResponse, summaryResponse, changesResponse] = await Promise.all([
      getJson<{ holdings: Holding[] }>(`/api/etf/${etfCode}/holdings?date=${selectedDate.value}`),
      getJson<{ summary: Summary | null }>(`/api/etf/${etfCode}/summary?date=${selectedDate.value}`),
      getJson<ChangesResponse>(`/api/etf/${etfCode}/changes?date=${selectedDate.value}`)
    ]);

    holdings.value = holdingsResponse.holdings;
    summary.value = summaryResponse.summary;
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

    <section class="summary-cards" aria-label="ETF summary">
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

    <section class="operation-cards">
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

    <section class="signal-grid">
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

    <section class="list-strip">
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

    <section class="holdings-panel">
      <div class="table-title">
        <div>
          <h2><Database :size="18" /> 全持股清單</h2>
          <p>{{ selectedDate }}，共 {{ displayedHoldings.length }} 筆</p>
        </div>
        <label class="search-box">
          <Search :size="16" />
          <input v-model="query" type="search" placeholder="搜尋股票代號或名稱" />
        </label>
      </div>

      <div class="holdings-table">
        <div class="holdings-head">
          <span>股票</span>
          <span>股數</span>
          <span>張數</span>
          <span>權重</span>
          <span>市值</span>
        </div>
        <div v-for="holding in displayedHoldings" :key="holding.stockId" class="holding-row">
          <span class="stock-cell"><b>{{ holding.stockId }}</b>{{ holding.stockName }}</span>
          <span>{{ formatNumber(holding.shares) }}</span>
          <span>{{ formatNumber(holding.lots) }}</span>
          <span>{{ formatPct(holding.weight, 2) }}</span>
          <span>{{ formatMoney(holding.marketValue) }}</span>
        </div>
      </div>
    </section>

    <footer class="disclaimer">
      本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。ETF 持股揭露可能有時間差，請以投信與交易所公告為準。
    </footer>
  </main>
</template>
