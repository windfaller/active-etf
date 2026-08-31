<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ArrowDown, ArrowUp, BarChart3, CalendarDays, ExternalLink, Medal, Trophy } from "@lucide/vue";
import { getJson } from "../apiClient";
import MemberLockedResult from "../components/MemberLockedResult.vue";
import { useAuth } from "../composables/useAuth";
import type { PerformanceMarket, PerformancePeriod, PerformanceResponse, PerformanceRow } from "../contracts/performance";
import { shouldMaskMemberResult } from "../domain/memberVisibility";

const props = defineProps<{ refreshKey: number }>();
const emit = defineEmits<{ navigate: [path: string] }>();
const { isAuthenticated } = useAuth();

const data = ref<PerformanceResponse | null>(null);
const loading = ref(true);
const error = ref("");
const market = ref<PerformanceMarket>("tw");
const period = ref<PerformancePeriod>("m1");
const descending = ref(true);

const section = computed(() => data.value?.sections[market.value] ?? null);
const periodLabel = computed(() => data.value?.periods.find((item) => item.key === period.value)?.label ?? "近期");
const rankedRows = computed(() => (section.value?.rows ?? [])
  .filter((row) => row.returns[period.value] !== null)
  .sort((left, right) => {
    const difference = (right.returns[period.value] ?? 0) - (left.returns[period.value] ?? 0);
    return descending.value ? difference : -difference;
  }));
const selectedMethodology = computed(() => data.value?.periods.find((item) => item.key === period.value)?.methodology ?? "");

function returnTone(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function formatReturn(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPrice(row: PerformanceRow): string {
  return new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.latestPrice);
}

function sourceLabel(row: PerformanceRow): string {
  if (row.priceSource === "nav") return "淨值";
  return "市價";
}

function fundPath(row: PerformanceRow): string {
  return row.market === "tw" ? `/etf/${row.etfCode}` : `/global-etfs/${row.etfCode}`;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    data.value = await getJson<PerformanceResponse>("/api/funds/performance");
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "績效排行暫時無法讀取。";
  } finally {
    loading.value = false;
  }
}

function selectMarket(next: PerformanceMarket): void {
  market.value = next;
  descending.value = true;
}

onMounted(load);
watch(() => props.refreshKey, load);
</script>

<template>
  <section class="performance-page">
    <header class="performance-hero">
      <div class="hero-copy">
        <h1>近期績效排行榜</h1>
        <p>用相同期間比較台灣主動式 ETF 與國際主題 ETF，快速找到近期領先與落後基金。</p>
        <div class="hero-meta"><CalendarDays :size="16" /><span>各基金採自身最近有效交易日</span><span aria-hidden="true">•</span><span>市價漲跌，不含配息再投資</span></div>
      </div>
      <div class="hero-mark" aria-hidden="true"><Trophy :size="38" /><strong>TOP</strong><span>近期排名</span></div>
    </header>

    <div class="ranking-toolbar" aria-label="排行榜篩選">
      <div class="market-switch" role="group" aria-label="市場">
        <button type="button" :class="{ active: market === 'tw' }" @click="selectMarket('tw')">台灣 ETF</button>
        <button type="button" :class="{ active: market === 'global' }" @click="selectMarket('global')">國際 ETF</button>
      </div>
      <div class="period-switch" role="group" aria-label="績效期間">
        <button v-for="item in data?.periods ?? [{key:'d1',label:'1 日'},{key:'w1',label:'1 週'},{key:'m1',label:'1 個月'},{key:'m3',label:'3 個月'}]" :key="item.key" type="button" :class="{ active: period === item.key }" @click="period = item.key as PerformancePeriod">{{ item.label }}</button>
      </div>
      <button class="order-button" type="button" :aria-pressed="!descending" @click="descending = !descending">
        <ArrowDown v-if="descending" :size="16" /><ArrowUp v-else :size="16" />
        {{ descending ? '領先排行' : '落後排行' }}
      </button>
    </div>

    <div v-if="loading" class="ranking-state" aria-live="polite"><BarChart3 :size="24" /><b>正在整理台灣與國際基金績效…</b></div>
    <div v-else-if="error" class="ranking-state ranking-state--error" role="alert"><b>排行榜讀取失敗</b><span>{{ error }}</span><button type="button" @click="load">重新載入</button></div>
    <template v-else-if="section">
      <div class="ranking-summary">
        <div><strong>{{ market === 'tw' ? '台灣主動式 ETF' : '國際 ETF' }}</strong><span>{{ periodLabel }} {{ descending ? '領先' : '落後' }}排行</span></div>
        <p>{{ selectedMethodology }}。共 {{ section.availableCount }} / {{ section.trackedCount }} 檔有價格資料，{{ rankedRows.length }} 檔具備本期比較基準。</p>
      </div>

      <section class="ranking-panel">
        <header><div><h2>完整排行榜</h2><p>點選基金可前往單檔持股與調倉資料。</p></div><span>{{ periodLabel }}・{{ descending ? '高至低' : '低至高' }}</span></header>
        <div v-if="rankedRows.length" class="ranking-table" role="table" aria-label="基金績效完整排行榜">
          <div class="ranking-head" role="row"><span>名次</span><span>基金</span><span>資料日／價格</span><span>1 日</span><span>1 週</span><span>1 個月</span><span>3 個月</span></div>
          <template v-for="(row, index) in rankedRows" :key="row.etfCode">
          <MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="排行榜資料已遮隱" :source="`performance_rank_${index + 1}`" />
          <button v-else class="ranking-row" type="button" role="row" @click="emit('navigate', fundPath(row))">
            <span :class="['rank-number', index < 3 ? `rank-number--${index + 1}` : '']" :aria-label="index < 3 ? `第 ${index + 1} 名` : undefined">
              <Medal v-if="index < 3" :size="22" aria-hidden="true" />
              <b>{{ index + 1 }}</b>
            </span>
            <span class="fund-identity"><b>{{ row.etfCode }}</b><strong>{{ row.fundName }}</strong><small>{{ row.issuer }}</small></span>
            <span class="price-cell"><b>{{ sourceLabel(row) }} {{ formatPrice(row) }} {{ row.currency }}</b><small>{{ row.latestDate }}</small></span>
            <span v-for="key in (['d1','w1','m1','m3'] as PerformancePeriod[])" :key="key" :class="['return-cell', returnTone(row.returns[key]), { selected: period === key }]">{{ formatReturn(row.returns[key]) }}</span>
          </button>
          </template>
        </div>
        <p v-else class="empty-ranking">這個期間尚無足夠的歷史價格可排序。</p>
      </section>

      <aside class="ranking-disclosure">
        <div><b>資料與口徑</b><p>{{ data?.methodology.returnType }}。{{ data?.methodology.dividendTreatment }}。</p></div>
        <div><b>日期與缺值</b><p>{{ data?.methodology.dateAlignment }}。{{ data?.methodology.missingData }}。</p></div>
        <a :href="section.sourceUrl" target="_blank" rel="noreferrer">{{ section.sourceName }} <ExternalLink :size="14" /></a>
      </aside>
    </template>
  </section>
</template>

<style scoped>
.performance-page{display:grid;gap:16px}.performance-hero{display:flex;align-items:center;justify-content:space-between;gap:30px;min-height:190px;padding:30px 34px;border-radius:16px;background:linear-gradient(118deg,#153d55 0%,#0d6968 74%,#0a7770 100%);color:#fff;box-shadow:0 18px 42px rgba(19,62,78,.18)}.hero-copy{display:grid;gap:10px}.hero-copy h1{margin:0;font-size:clamp(30px,4vw,48px);line-height:1.08;letter-spacing:-.035em}.hero-copy>p{max-width:720px;margin:0;color:#d9ecec;font-size:15px;line-height:1.7}.hero-meta{display:flex;align-items:center;gap:8px;color:#c6dfdf;font-size:12px}.hero-mark{display:grid;place-items:center;flex:0 0 132px;width:132px;height:132px;border:1px solid rgba(255,255,255,.3);border-radius:50%;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 8px rgba(255,255,255,.04)}.hero-mark strong{font-size:25px;letter-spacing:.08em}.hero-mark span{font-size:11px}.ranking-toolbar{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface);box-shadow:0 8px 24px rgba(28,48,65,.06)}.market-switch,.period-switch{display:flex;gap:4px}.ranking-toolbar button{min-height:40px;padding:0 13px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--theme-text-muted);font-size:13px;font-weight:780;cursor:pointer}.market-switch{padding:3px;border-radius:9px;background:var(--theme-surface-muted)}.market-switch button.active{background:#173f56;color:#fff;box-shadow:0 2px 8px rgba(23,63,86,.2)}.period-switch{margin-left:auto}.period-switch button{border-color:var(--theme-border);background:var(--theme-surface)}.period-switch button.active{border-color:#0d7770;background:#e8f5f3;color:#096a64}.order-button{display:flex;align-items:center;gap:6px!important;border-color:#b8ccd3!important;color:#31566c!important}.ranking-state{display:flex;align-items:center;justify-content:center;gap:10px;min-height:300px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface);color:var(--theme-text-muted)}.ranking-state--error{display:grid;place-items:center;align-content:center}.ranking-state--error button{min-height:42px;padding:0 14px;border:0;border-radius:8px;background:#173f56;color:#fff;font-weight:760}.ranking-summary{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:4px 2px}.ranking-summary>div{display:grid;gap:3px}.ranking-summary strong{font-size:22px;color:var(--theme-text-strong)}.ranking-summary span,.ranking-summary p{color:var(--theme-text-muted)}.ranking-summary p{max-width:700px;margin:0;text-align:right;font-size:12px;line-height:1.6}.podium{display:grid;grid-template-columns:1.18fr 1fr 1fr;gap:12px}.podium-card{display:grid;align-content:start;gap:6px;min-width:0;min-height:174px;padding:20px;border:1px solid var(--theme-border);border-radius:13px;background:var(--theme-surface);color:var(--theme-text);text-align:left;cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.podium-card:hover{transform:translateY(-2px);border-color:#90abae;box-shadow:0 12px 28px rgba(28,48,65,.1)}.podium-card--1{border-color:#d3b35c;background:linear-gradient(145deg,#fffaf0,#fff 58%)}.podium-rank{display:flex;align-items:center;gap:6px;color:#8d701e;font-size:12px;font-weight:850}.podium-code{color:var(--theme-text-muted);font-size:12px;font-weight:800;letter-spacing:.08em}.podium-card>strong{overflow:hidden;text-overflow:ellipsis;color:var(--theme-text-strong);font-size:15px;white-space:nowrap}.podium-card>b{margin-top:auto;font-size:30px;line-height:1}.podium-card small{color:var(--theme-text-muted)}.ranking-panel{overflow:hidden;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.ranking-panel>header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--theme-border)}.ranking-panel h2,.ranking-panel p{margin:0}.ranking-panel h2{color:var(--theme-text-strong);font-size:18px}.ranking-panel header p,.ranking-panel header>span{color:var(--theme-text-muted);font-size:12px}.ranking-table{display:grid}.ranking-head,.ranking-row{display:grid;grid-template-columns:56px minmax(220px,1.5fr) minmax(150px,.8fr) repeat(4,minmax(86px,.48fr));align-items:center;min-width:940px}.ranking-head{min-height:42px;padding:0 16px;background:var(--theme-surface-muted);color:var(--theme-text-muted);font-size:11px;font-weight:800}.ranking-row{min-height:72px;padding:0 16px;border:0;border-top:1px solid var(--theme-border);background:var(--theme-surface);color:var(--theme-text);text-align:left;cursor:pointer}.ranking-row:hover{background:var(--theme-surface-muted)}.rank-number{width:30px;color:var(--theme-text-muted);font-size:16px;font-weight:850;text-align:center}.fund-identity,.price-cell{display:grid;gap:2px;min-width:0}.fund-identity b{color:#0b756f;font-size:13px}.fund-identity strong{overflow:hidden;text-overflow:ellipsis;color:var(--theme-text-strong);font-size:13px;white-space:nowrap}.fund-identity small,.price-cell small{color:var(--theme-text-muted);font-size:11px}.price-cell b{font-size:12px}.return-cell{padding:8px 6px;font-size:13px;font-weight:830;text-align:right}.return-cell.selected{border-radius:7px;background:var(--theme-neutral-soft)}.empty-ranking{padding:50px 20px!important;color:var(--theme-text-muted);text-align:center}.ranking-disclosure{display:grid;grid-template-columns:1fr 1fr auto;align-items:center;gap:24px;padding:17px 20px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface)}.ranking-disclosure div{display:grid;gap:3px}.ranking-disclosure b{color:var(--theme-text-strong);font-size:12px}.ranking-disclosure p{margin:0;color:var(--theme-text-muted);font-size:11px;line-height:1.55}.ranking-disclosure a{display:flex;align-items:center;gap:6px;color:#345986;font-size:12px;font-weight:760;white-space:nowrap}
[data-theme="dark"] .podium-card--1{border-color:#7a6733;background:linear-gradient(145deg,#2b2518,var(--theme-surface) 58%)}[data-theme="dark"] .market-switch button.active{background:#24566f}[data-theme="dark"] .period-switch button.active{border-color:#3a837c;background:#173532;color:#83dfd5}[data-theme="dark"] .order-button{color:#9fc6da!important}
@media(max-width:900px){.ranking-toolbar{flex-wrap:wrap}.period-switch{order:3;width:100%;margin-left:0}.period-switch button{flex:1}.ranking-table{overflow-x:auto}.ranking-disclosure{grid-template-columns:1fr 1fr}.ranking-disclosure a{grid-column:1/-1}}
@media(max-width:660px){.performance-hero{min-height:0;padding:23px 20px}.hero-copy h1{font-size:32px}.hero-copy>p{font-size:13px}.hero-meta{align-items:flex-start;flex-wrap:wrap}.hero-mark{display:none}.ranking-toolbar{align-items:stretch}.market-switch{width:100%}.market-switch button{flex:1}.period-switch{display:grid;grid-template-columns:repeat(4,1fr)}.period-switch button{padding:0 5px;font-size:12px}.order-button{width:100%;justify-content:center}.ranking-summary{display:grid}.ranking-summary p{text-align:left}.podium{grid-template-columns:1fr}.podium-card{min-height:145px}.podium-card--1{min-height:165px}.podium-card>strong{white-space:normal}.ranking-panel>header{align-items:flex-start}.ranking-panel header>span{flex:0 0 auto}.ranking-head{display:none}.ranking-table{gap:8px;padding:10px;overflow:visible}.ranking-row{grid-template-columns:42px 1fr repeat(4,1fr);min-width:0;padding:13px 8px;border:1px solid var(--theme-border);border-radius:10px}.fund-identity{grid-column:2/-1}.price-cell{grid-column:2/-1;margin:4px 0 6px}.return-cell{display:grid;gap:2px;padding:8px 3px;text-align:center}.return-cell::before{color:var(--theme-text-muted);font-size:9px;font-weight:700}.return-cell:nth-of-type(4)::before{content:'1日'}.return-cell:nth-of-type(5)::before{content:'1週'}.return-cell:nth-of-type(6)::before{content:'1月'}.return-cell:nth-of-type(7)::before{content:'3月'}.rank-number{grid-row:1/4;align-self:start;padding-top:4px}.ranking-disclosure{grid-template-columns:1fr}.ranking-disclosure a{grid-column:auto}}
.rank-number{position:relative;display:grid;place-items:center;width:32px;min-height:32px;padding:0;color:var(--theme-text-muted);font-size:16px;font-weight:850;text-align:center}.rank-number svg,.rank-number b{grid-area:1/1}.rank-number b{color:inherit;font-size:16px}.rank-number[class*="rank-number--"] b{margin-top:1px;color:#fff;font-size:9px}.rank-number--1{color:#c99a19}.rank-number--2{color:#8b98a3}.rank-number--3{color:#b7773e}
</style>
