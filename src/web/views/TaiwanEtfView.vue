<script setup lang="ts">
import { computed, ref } from "vue";
import { BarChart3, Database, LineChart, Search } from "@lucide/vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import type { Change, ChangesResponse, Holding, Summary } from "../contracts/dashboard";
import type { TaiwanEtfPage, TaiwanEtfSection } from "../contracts/navigation";
import { directionLabel, formatLots, formatMoney, formatNumber, formatSignedPp, formatWeight, valueTone } from "../utils/format";

interface TaiwanEtfOption { etfCode: string; name: string; issuer: string; source: { infoUrl: string } }
const props = defineProps<{
  options: TaiwanEtfOption[];
  selectedCode: string;
  page: TaiwanEtfPage;
  section: TaiwanEtfSection;
  selectedDate: string;
  sourceLatestDate: string;
  summary: Summary | null;
  summaries: Summary[];
  changes: ChangesResponse;
  holdings: Holding[];
  loading: boolean;
}>();
const emit = defineEmits<{ select: [code: string]; report: []; premium: []; changes: []; style: [] }>();
const holdingQuery = ref("");
const selected = computed(() => props.options.find((row) => row.etfCode === props.selectedCode) ?? props.options[0]);
const operationRows = computed(() => {
  const byStock = new Map<string, Change>();
  [...props.changes.newHoldings, ...props.changes.exitedHoldings, ...props.changes.topIncreases, ...props.changes.topDecreases, ...props.changes.topActiveIncreases, ...props.changes.topActiveDecreases].forEach((row) => byStock.set(row.stockId, row));
  return [...byStock.values()].filter((row) => row.diffShares !== 0 || row.status === "new" || row.status === "exit").sort((a,b) => Math.abs(b.activeDiffLots ?? b.diffLots) - Math.abs(a.activeDiffLots ?? a.diffLots));
});
const displayedHoldings = computed(() => {
  const query = holdingQuery.value.trim().toLowerCase();
  return [...props.holdings].filter((row) => !query || `${row.stockId} ${row.stockName}`.toLowerCase().includes(query)).sort((a,b) => (b.weight ?? 0) - (a.weight ?? 0));
});
const premiumRows = computed(() => [...props.summaries].sort((a,b) => b.tradeDate.localeCompare(a.tradeDate)));
function operationStatus(row: Change): string { if (row.status === "new" || row.prevShares === 0) return "新增"; if (row.status === "exit" || row.currentShares === 0) return "刪除"; return directionLabel(row.activeDiffLots ?? row.diffLots); }
</script>

<template>
  <section class="view-shell taiwan-etf-view">
    <header class="view-heading">
      <div><span class="eyebrow">台灣單檔 ETF</span><h1>{{ selected?.etfCode }} {{ selected?.name }}</h1><p>{{ selected?.issuer }}｜畫面日期 {{ selectedDate || "-" }}｜來源最新 {{ sourceLatestDate || "-" }}</p></div>
      <label class="etf-select"><span>選擇 ETF</span><select :value="selectedCode" @change="emit('select', ($event.target as HTMLSelectElement).value)"><option v-for="etf in options" :key="etf.etfCode" :value="etf.etfCode">{{ etf.etfCode }} {{ etf.name }}</option></select></label>
    </header>

    <nav class="etf-subnav" aria-label="單檔 ETF 頁面">
      <button type="button" :class="{ active: page === 'report' && section === 'overview' }" @click="emit('report')">持股總覽</button>
      <button type="button" :class="{ active: page === 'report' && section === 'changes' }" @click="emit('changes')">持股變化</button>
      <button type="button" :class="{ active: page === 'premiumHistory' }" @click="emit('premium')">折溢價歷史</button>
      <button type="button" @click="emit('style')">經理人風格</button>
    </nav>

    <template v-if="page === 'premiumHistory'">
      <section class="data-panel">
        <div class="panel-heading"><div><h2><LineChart :size="19" /> 折溢價歷史</h2><p>正值為溢價，負值為折價。</p></div></div>
        <ResponsiveDataTable label="ETF 折溢價歷史" :empty="!loading && !premiumRows.length">
          <div class="simple-table"><div class="table-head"><span>交易日</span><span>市價</span><span>淨值</span><span>折溢價</span></div><div v-for="row in premiumRows" :key="row.tradeDate" class="table-row"><span>{{ row.tradeDate }}</span><span>{{ formatNumber(row.marketPrice,2) }}</span><span>{{ formatNumber(row.nav,2) }}</span><span :class="valueTone(row.premiumDiscount)">{{ formatSignedPp(row.premiumDiscount) }}</span></div></div>
          <template #mobile><MobileDataCard v-for="row in premiumRows" :key="row.tradeDate" :label="row.tradeDate" :tone="(row.premiumDiscount ?? 0) > 0 ? 'increase' : (row.premiumDiscount ?? 0) < 0 ? 'decrease' : 'neutral'" :expandable="false"><template #title>{{ row.tradeDate }}</template><template #summary><span :class="valueTone(row.premiumDiscount)">{{ (row.premiumDiscount ?? 0) > 0 ? '溢價' : (row.premiumDiscount ?? 0) < 0 ? '折價' : '持平' }} {{ formatSignedPp(row.premiumDiscount) }}</span><br />市價 {{ formatNumber(row.marketPrice,2) }}｜淨值 {{ formatNumber(row.nav,2) }}</template></MobileDataCard></template>
        </ResponsiveDataTable>
      </section>
    </template>

    <template v-else>
      <section class="summary-grid">
        <article><span>基金規模</span><strong>{{ formatMoney(summary?.fundSize) }}</strong><small>公開揭露資料</small></article>
        <article><span>折溢價</span><strong :class="valueTone(summary?.premiumDiscount)">{{ formatSignedPp(summary?.premiumDiscount) }}</strong><small>市價 {{ formatNumber(summary?.marketPrice,2) }}｜淨值 {{ formatNumber(summary?.nav,2) }}</small></article>
        <article><span>股票／現金</span><strong>{{ formatWeight(summary?.stockRatio,1) }}</strong><small>現金 {{ formatWeight(summary?.cashRatio,1) }}</small></article>
      </section>

      <section id="changes-panel" class="data-panel">
        <div class="panel-heading"><div><h2><BarChart3 :size="19" /> 單檔 ETF 調倉</h2><p>主動淨變動已排除基金規模對持股數量的影響。</p></div></div>
        <ResponsiveDataTable label="單檔 ETF 調倉" :empty="!loading && !operationRows.length">
          <div class="change-table"><div class="table-head"><span>股票</span><span>操作</span><span>主動淨變動</span><span>表面變動</span><span>權重變動</span><span>目前權重</span></div><div v-for="row in operationRows" :key="row.stockId" class="table-row"><span class="stock"><b>{{ row.stockId }}</b><small>{{ row.stockName }}</small></span><span :class="valueTone(row.activeDiffLots ?? row.diffLots)">{{ operationStatus(row) }}</span><span :class="valueTone(row.activeDiffLots ?? row.diffLots)">{{ formatLots(row.activeDiffLots ?? row.diffLots) }} 張</span><span :class="valueTone(row.diffLots)">{{ formatLots(row.diffLots) }} 張</span><span :class="valueTone(row.diffWeightPoint)">{{ formatSignedPp(row.diffWeightPoint) }}</span><span>{{ formatWeight(row.currentWeight) }}</span></div></div>
          <template #mobile><MobileDataCard v-for="row in operationRows" :key="row.stockId" :label="`${row.stockId} ${row.stockName}`" :tone="(row.activeDiffLots ?? row.diffLots) > 0 ? 'increase' : (row.activeDiffLots ?? row.diffLots) < 0 ? 'decrease' : 'neutral'" :expandable="false"><template #title>{{ row.stockId }} {{ row.stockName }}</template><template #summary><span :class="valueTone(row.activeDiffLots ?? row.diffLots)">{{ operationStatus(row) }}｜主動 {{ formatLots(row.activeDiffLots ?? row.diffLots) }} 張</span><br /><span :class="valueTone(row.diffWeightPoint)">權重變化 {{ formatSignedPp(row.diffWeightPoint) }}</span>｜目前 {{ formatWeight(row.currentWeight) }}</template></MobileDataCard></template>
        </ResponsiveDataTable>
      </section>

      <section v-if="section === 'overview'" class="data-panel">
        <div class="panel-heading"><div><h2><Database :size="19" /> 單檔 ETF 持股</h2><p>依目前權重排序，手機版直接顯示股數與市值。</p></div><label class="holding-search"><Search :size="15" /><input v-model="holdingQuery" type="search" placeholder="搜尋持股" /></label></div>
        <ResponsiveDataTable label="單檔 ETF 持股" :empty="!loading && !displayedHoldings.length">
          <div class="holdings-table-new"><div class="table-head"><span>股票</span><span>持股張數</span><span>市值</span><span>目前權重</span><span>股數</span></div><div v-for="row in displayedHoldings" :key="row.stockId" class="table-row"><span class="stock"><b>{{ row.stockId }}</b><small>{{ row.stockName }}</small></span><span>{{ formatNumber(row.lots) }}</span><span>{{ formatMoney(row.marketValue) }}</span><span>{{ formatWeight(row.weight) }}</span><span>{{ formatNumber(row.shares) }}</span></div></div>
          <template #mobile><MobileDataCard v-for="row in displayedHoldings" :key="row.stockId" :label="`${row.stockId} ${row.stockName}`" :expandable="false"><template #title>{{ row.stockId }} {{ row.stockName }}</template><template #summary>權重 {{ formatWeight(row.weight) }}｜{{ formatNumber(row.lots) }} 張｜市值 {{ formatMoney(row.marketValue) }}<br />持股股數 {{ formatNumber(row.shares) }}</template></MobileDataCard></template>
        </ResponsiveDataTable>
      </section>
    </template>

    <SourceDisclosure :source-url="selected?.source.infoUrl" :note="`${selected?.issuer ?? ''}官方持股與淨值資料；不同來源公告時點可能不同。`" />
  </section>
</template>

<style scoped>
.view-shell{display:grid;gap:16px}.view-heading{display:flex;justify-content:space-between;gap:24px;padding:28px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.eyebrow{color:#087b72;font-size:12px;font-weight:850;letter-spacing:.12em}.view-heading h1{margin:8px 0 7px;color:#1e2c38;font-size:32px}.view-heading p{margin:0;color:#6d7984}.etf-select{display:grid;gap:6px;align-self:center;color:#64717c;font-size:12px;font-weight:760}.etf-select select{min-width:290px;height:44px;padding:0 12px;border:1px solid #d6dfe3;border-radius:9px;background:#fff}.etf-subnav{display:flex;gap:6px;padding:6px;border:1px solid #dfe6e9;border-radius:11px;background:#fff}.etf-subnav button{min-height:42px;padding:0 16px;border:0;border-radius:8px;background:transparent;color:#64717c;font-weight:760;cursor:pointer}.etf-subnav button.active{background:#173f56;color:#fff}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.summary-grid article{display:grid;gap:7px;padding:18px;border:1px solid #dfe6e9;border-radius:12px;background:#fff}.summary-grid span,.summary-grid small{color:#74818b;font-size:12px}.summary-grid strong{color:#26343f;font-size:22px}.data-panel{padding:23px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.panel-heading{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:16px}.panel-heading h2{display:flex;align-items:center;gap:8px;margin:0 0 5px;color:#25333e}.panel-heading p{margin:0;color:#71808a;font-size:13px}.table-head,.table-row{display:grid;align-items:center;gap:12px}.simple-table .table-head,.simple-table .table-row{grid-template-columns:1.2fr 1fr 1fr 1fr}.change-table .table-head,.change-table .table-row{grid-template-columns:1.3fr .7fr 1.1fr 1fr 1fr 1fr}.holdings-table-new .table-head,.holdings-table-new .table-row{grid-template-columns:1.4fr 1fr 1fr 1fr 1fr}.simple-table,.change-table,.holdings-table-new{overflow:hidden;border:1px solid #e1e7ea;border-radius:10px}.table-head{padding:11px 14px;background:#f2f6f7;color:#66737e;font-size:12px;font-weight:780}.table-row{min-height:62px;padding:9px 14px;border-top:1px solid #edf1f3;color:#394752}.table-row>span{display:grid;gap:3px}.table-row small{color:#7a8791}.positive{color:var(--theme-positive);font-weight:760}.negative{color:var(--theme-negative);font-weight:760}.neutral{color:var(--theme-neutral);font-weight:760}.holding-search{display:flex;align-items:center;gap:7px;width:230px;height:42px;padding:0 11px;border:1px solid #d7e0e4;border-radius:9px}.holding-search input{width:100%;border:0;outline:0}.stock b{font-size:15px}
@media(max-width:760px){.view-heading{display:grid;padding:20px 16px}.view-heading h1{font-size:27px}.etf-select select{width:100%;min-width:0}.etf-subnav{overflow:auto}.etf-subnav button{flex:0 0 auto;min-height:44px}.summary-grid{grid-template-columns:1fr}.data-panel{padding:16px 12px}.panel-heading{display:grid}.holding-search{width:100%}}
</style>
