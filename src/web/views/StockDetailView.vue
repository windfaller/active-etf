<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { Building2, CalendarRange, Database, Globe2, Scale } from "@lucide/vue";
import IntelligenceMetaStrip from "../components/IntelligenceMetaStrip.vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import { useStockOverview } from "../composables/useStockOverview";
import type { StockMarket } from "../contracts/stocks";
import { formatLots, formatMoney, formatNumber, formatSigned, formatSignedPp, formatWeight } from "../utils/format";

const props = defineProps<{ market: StockMarket; symbol: string; refreshKey?: number }>();
const { overview, history, etfs, institutions, loading, error, load, abort } = useStockOverview();
const trendCards = computed(() => ([3,5,20] as const).map((window) => {
  const points = history.value?.points.slice(0, window) ?? [];
  const activeValues = points.map((row) => row.activeNetLots).filter((value): value is number => value !== null && value !== undefined);
  const latest = points[0];
  return {
    window,
    cumulative: props.market === "tw" ? (activeValues.length ? activeValues.reduce((sum,value) => sum + value, 0) : null) : latest?.totalWeightPercent ?? null,
    increases: points.filter((row) => row.direction === "increase").length,
    decreases: points.filter((row) => row.direction === "decrease").length,
    ratio: latest?.sameDirectionEtfRatio ?? null,
    coverage: history.value?.coverage.tracked ? history.value.coverage.available / history.value.coverage.tracked : 0
  };
}));
const relationLabel = computed(() => ({ aligned: "方向一致", divergent: "方向分歧", insufficient: "資料不足" })[overview.value?.today?.institutionRelation ?? "insufficient"]);
const confidenceLabel = (level: string) => ({ high: "高", medium: "中", low: "低" })[level] ?? level;

watch(() => [props.market, props.symbol, props.refreshKey], () => void load(props.market, props.symbol), { immediate: true });
onBeforeUnmount(abort);
</script>

<template>
  <section class="stock-view">
    <header class="stock-hero"><div><span class="eyebrow">{{ market === 'tw' ? '台灣股票情報' : '美國股票情報' }}</span><h1>{{ overview?.stock.symbol ?? symbol }} {{ overview?.stock.name ?? '' }}</h1><p>{{ overview?.stock.sector ?? '產業資料待補' }}｜{{ market === 'tw' ? '交易日主動調倉與法人方向' : '海外 ETF 與 13F 使用不同時間尺度' }}</p></div><div class="hero-facts"><span>涵蓋 ETF</span><b>{{ overview?.summary.coveredEtfs ?? 0 }}</b><small>資料日 {{ overview?.sourceAsOf ?? '-' }}</small></div></header>
    <p v-if="error" class="p1-error">{{ error }}</p><p v-else-if="loading && !overview" class="p1-state">股票情報載入中…</p>
    <IntelligenceMetaStrip v-if="overview" :source-as-of="overview.sourceAsOf" :generated-at="overview.generatedAt" :coverage="overview.coverage" :confidence="overview.confidence" />

    <template v-if="overview?.today">
      <section class="metric-grid today-metrics"><article><span>主動淨變動</span><strong :class="(overview.today.activeNetLots ?? 0) >= 0 ? 'positive' : 'negative'">{{ formatLots(overview.today.activeNetLots) }} 張</strong><small>系統計算：排除基金規模變化</small></article><article><span>表面張數變動</span><strong>{{ formatLots(overview.today.surfaceNetLots) }} 張</strong><small>可觀察事實：公開持股差額</small></article><article><span>ETF 方向</span><strong>{{ overview.today.increaseEtfCount }} 加／{{ overview.today.decreaseEtfCount }} 減</strong><small>neutral {{ overview.today.neutralEtfCount }}｜未知 {{ overview.today.unknownEtfCount }}</small></article><article><span>多數共識</span><strong>{{ overview.today.consensus.formed ? '已形成' : '未形成' }}</strong><small>同方向 {{ overview.today.consensus.sameDirectionRatio === null ? '-' : formatNumber(overview.today.consensus.sameDirectionRatio * 100,0) + '%' }}</small></article><article><span>ETF × 法人</span><strong>{{ relationLabel }}</strong><small>任一側缺資料時不以零替代</small></article></section>

      <section class="p1-panel"><div class="panel-title"><CalendarRange :size="20" /><div><h2>3／5／20 個有效交易日趨勢</h2><p>週末、假日與來源延遲不列入交易日 window；缺少實際觀察會中斷連續訊號。</p></div></div><div class="trend-grid"><article v-for="trend in trendCards" :key="trend.window"><b>{{ trend.window }} 日</b><strong :class="(trend.cumulative ?? 0) >= 0 ? 'positive' : 'negative'">累積 {{ formatLots(trend.cumulative) }} 張</strong><span>加碼日 {{ trend.increases }}｜減碼日 {{ trend.decreases }}</span><small>當期涵蓋 {{ formatNumber(trend.coverage * 100,0) }}%</small></article></div><p v-if="history?.summary" class="research-note"><b>系統計算：</b>目前連續 {{ history.summary.consecutive.tradingDays }} 個交易日 {{ history.summary.consecutive.direction === 'increase' ? '加碼' : history.summary.consecutive.direction === 'decrease' ? '減碼' : '未形成方向' }}；有效觀察 {{ history.summary.consecutive.actualObservationCount }}/{{ history.summary.consecutive.actualObservationCount + history.summary.consecutive.missingObservationCount }}；{{ history.summary.reversal.detected ? `最近反轉日 ${history.summary.reversal.date}` : '未達反轉條件' }}。</p></section>
    </template>

    <section v-if="market === 'us' && overview?.overseasEtfExposure" class="p1-panel"><div class="panel-title"><Globe2 :size="20" /><div><h2>海外 ETF 曝險</h2><p>{{ overview.overseasEtfExposure.timeScale }}</p></div></div><div class="exposure-grid"><article v-for="row in overview.overseasEtfExposure.rows" :key="`${row.etfCode}-${row.assetType}`"><b>{{ row.etfCode }} {{ row.fundName }}</b><strong>{{ formatWeight(row.weightPercent) }}</strong><span>{{ row.assetType }}｜持股日 {{ row.sourceAsOf }}</span></article></div></section>

    <section v-if="overview" class="p1-panel"><div class="panel-title"><Database :size="20" /><div><h2>ETF 明細</h2><p>{{ market === 'tw' ? '持股與規模校正後調整；缺日為 unknown' : '相同 ticker 仍依 exposure 類型分開' }}</p></div></div><ResponsiveDataTable label="股票 ETF 明細" :empty="!loading && !(etfs?.rows.length)"><div class="etf-detail-table"><div class="table-head"><span>ETF</span><span>權重</span><span>權重變化</span><span>{{ market === 'tw' ? '主動淨變動' : 'Exposure' }}</span><span>連續方向</span><span>資料日／信心</span></div><div v-for="row in etfs?.rows ?? []" :key="`${row.etfCode}-${row.assetType ?? ''}`" class="table-row"><span><b>{{ row.etfCode }}</b><small>{{ row.name }}</small></span><span>{{ formatWeight(row.latestWeight) }}</span><span>{{ formatSignedPp(row.weightChange) }}</span><span>{{ market === 'tw' ? `${formatLots(row.activeNetLots)} 張` : (row.assetType ?? '-') }}</span><span>{{ row.consecutiveTradingDays ? `${row.consecutiveTradingDays} 日 ${row.consecutiveDirection === 'increase' ? '加碼' : '減碼'}` : '-'}}<small v-if="row.directionConflict" class="conflict-flag">方向指標分歧</small></span><span>{{ row.dataDate ?? '-' }}<small>信心 {{ confidenceLabel(row.confidence) }}</small><small v-if="row.observationCoverage">有效觀察 {{ row.observationCoverage.actual }}/{{ row.observationCoverage.expected }}</small></span></div></div><template #mobile><MobileDataCard v-for="row in etfs?.rows ?? []" :key="`${row.etfCode}-${row.assetType ?? ''}`" :label="row.etfCode" :tone="(row.activeNetLots ?? row.weightChange ?? 0) >= 0 ? 'increase' : 'decrease'" :expandable="false"><template #title>{{ row.etfCode }} {{ row.name }}</template><template #summary>權重 {{ formatWeight(row.latestWeight) }}｜變化 {{ formatSignedPp(row.weightChange) }}<br />{{ market === 'tw' ? `主動 ${formatLots(row.activeNetLots)} 張` : `類型 ${row.assetType ?? '-'}` }}｜{{ row.dataDate ?? '-' }}<template v-if="row.observationCoverage"><br />有效觀察 {{ row.observationCoverage.actual }}/{{ row.observationCoverage.expected }}</template><template v-if="row.directionConflict"><br /><span class="conflict-flag">方向指標分歧</span></template></template></MobileDataCard></template></ResponsiveDataTable></section>

    <section v-if="overview && market === 'tw'" class="p1-panel"><div class="panel-title"><Building2 :size="20" /><div><h2>三大法人方向</h2><p>{{ institutions?.timeScale ?? '台灣交易日' }}；未知值保留為未知。</p></div></div><div v-if="institutions?.row" class="metric-grid institution-grid"><article><span>外資</span><strong>{{ formatNumber(institutions.row.foreignNetShares) }}</strong><small>股</small></article><article><span>投信</span><strong>{{ formatNumber(institutions.row.investmentTrustNetShares) }}</strong><small>股</small></article><article><span>自營商</span><strong>{{ formatNumber(institutions.row.dealerNetShares) }}</strong><small>股</small></article><article><span>三大法人合計</span><strong>{{ formatSigned(institutions.row.totalNetShares) }}</strong><small>{{ relationLabel }}</small></article></div><p v-else class="p1-state">此資料日沒有法人資料，不以零替代。</p></section>

    <section v-if="overview && market === 'us'" class="p1-panel filing-panel"><div class="panel-title"><Scale :size="20" /><div><h2>機構 13F 季度持倉</h2><p>持倉截止日、SEC 申報日與系統取得時間分開顯示；不合併為今日淨買入。</p></div></div><div v-if="overview.sec13f?.rows.length" class="filing-cards"><article v-for="row in overview.sec13f.rows" :key="row.institutionCode"><b>{{ row.institutionName }}</b><strong>{{ row.institutionCode }}｜{{ formatNumber(row.shares) }} 股</strong><span>持倉截止 {{ row.periodOfReport }}</span><span>SEC 申報 {{ row.filedAt ?? '未知' }}</span><span>系統取得 {{ new Date(row.capturedAt).toLocaleString('zh-TW',{hour12:false}) }}</span></article></div><p v-else class="p1-state">目前沒有追蹤到此股票的 13F 資料。</p></section>

    <SourceDisclosure v-if="overview" :note="overview.summary.primarySources.join('；') + '。可觀察事實、系統計算與研究解讀在頁面上分開標示。'" />
  </section>
</template>

<style scoped>
.stock-view{display:grid;gap:16px}.stock-hero{display:flex;justify-content:space-between;gap:24px;padding:28px;border:1px solid var(--theme-border);border-radius:15px;background:var(--theme-surface)}.eyebrow{color:#087b72;font-size:12px;font-weight:850;letter-spacing:.13em}.stock-hero h1{margin:8px 0;color:var(--theme-text-strong);font-size:34px}.stock-hero p,.p1-state{margin:0;color:var(--theme-text-muted)}.hero-facts{display:grid;align-content:center;justify-items:end;min-width:244px;min-height:76px}.hero-facts span,.hero-facts small{color:var(--theme-text-muted);font-size:12px}.hero-facts b{color:var(--theme-text-strong);font-size:30px}.metric-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.metric-grid article,.trend-grid article,.exposure-grid article,.filing-cards article{display:grid;gap:6px;padding:16px;border:1px solid var(--theme-border);border-radius:11px;background:var(--theme-surface)}.metric-grid span,.metric-grid small,.trend-grid span,.trend-grid small,.exposure-grid span,.filing-cards span{color:var(--theme-text-muted);font-size:12px}.metric-grid strong,.trend-grid strong,.exposure-grid strong,.filing-cards strong{color:var(--theme-text-strong);font-size:18px}.p1-panel{display:grid;gap:15px;padding:22px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.panel-title{display:flex;align-items:flex-start;gap:9px}.panel-title h2{margin:0 0 4px;color:var(--theme-text-strong);font-size:20px}.panel-title p{margin:0;color:var(--theme-text-muted);font-size:13px}.trend-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.research-note{margin:0;padding:12px;border-left:4px solid #148b83;background:var(--theme-surface-muted);color:var(--theme-text-muted);line-height:1.6}.positive{color:#b93f36!important}.negative{color:#087b72!important}.etf-detail-table{overflow:hidden;border:1px solid var(--theme-border);border-radius:10px}.table-head,.table-row{display:grid;grid-template-columns:1.3fr .75fr .9fr 1fr 1fr 1.1fr;gap:10px;align-items:center}.table-head{padding:10px 12px;background:var(--theme-surface-muted);color:var(--theme-text-muted);font-size:12px;font-weight:780}.table-row{min-height:62px;padding:9px 12px;border-top:1px solid var(--theme-border);color:var(--theme-text)}.table-row>span{display:grid;gap:3px}.table-row small{color:var(--theme-text-muted)}.institution-grid{grid-template-columns:repeat(4,1fr)}.exposure-grid,.filing-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.p1-error{margin:0;padding:13px;border:1px solid #f1c4c0;border-radius:10px;background:#fff4f3;color:#a8322a}
.conflict-flag{color:#b26a00!important;font-weight:800}
@media(max-width:900px){.metric-grid{grid-template-columns:repeat(2,1fr)}.today-metrics article:last-child{grid-column:1 / -1}.exposure-grid,.filing-cards{grid-template-columns:repeat(2,1fr)}}
@media(max-width:660px){.stock-hero{display:grid;padding:21px 17px}.stock-hero h1{font-size:28px}.hero-facts{justify-items:start}.metric-grid,.institution-grid,.trend-grid,.exposure-grid,.filing-cards{grid-template-columns:1fr}.today-metrics article:last-child{grid-column:auto}.p1-panel{padding:16px 12px}}
</style>
