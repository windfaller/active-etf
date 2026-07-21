<script setup lang="ts">
import { computed, ref } from "vue";
import { BarChart3, Search } from "@lucide/vue";
import CoverageStatus from "../components/CoverageStatus.vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import type { EtfCoverageResponse, SectorSummaryRow, StockImpact } from "../contracts/dashboard";
import { directionLabel, formatLots, formatMoney, formatSignedPp } from "../utils/format";

const props = defineProps<{
  impacts: StockImpact[];
  sectors: SectorSummaryRow[];
  coverage: EtfCoverageResponse | null;
  selectedDate: string;
  loading: boolean;
  focusStockId?: string;
}>();
const emit = defineEmits<{ etf: [code: string]; stock: [stockId: string] }>();
const query = ref("");
const displayed = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  if (!normalized) return props.impacts;
  return props.impacts.filter((row) => `${row.stockId} ${row.stockName} ${row.sector} ${row.themeTags.join(" ")} ${row.etfs.map((etf) => etf.etfCode).join(" ")}`.toLowerCase().includes(normalized));
});
const leadSectors = computed(() => [...props.sectors].filter((row) => row.sector !== "其他").sort((a,b) => Math.abs(b.totalActiveDiffLots) - Math.abs(a.totalActiveDiffLots)).slice(0,6));
function institutionLots(row: StockImpact): number | null { const value = row.institutional?.totalNetShares; return value === null || value === undefined ? null : value / 1000; }
</script>

<template>
  <section class="view-shell taiwan-market-view">
    <header class="view-heading">
      <div><span class="eyebrow">台灣 ETF</span><h1>台灣主動式 ETF 市場總覽</h1><p>從個股、產業與影響 ETF 數量比較當日機構調倉，並保留法人與交易資訊。</p></div>
      <span class="date-pill">資料日 {{ selectedDate || "-" }}</span>
    </header>

    <CoverageStatus :coverage="coverage" :sample-count="impacts.length" compact />

    <section class="market-sector-grid" aria-label="重點產業方向">
      <article v-for="row in leadSectors" :key="row.sector" :class="row.totalActiveDiffLots >= 0 ? 'increase' : 'decrease'">
        <span>{{ row.sector }}</span><strong>{{ formatLots(row.totalActiveDiffLots) }} 張</strong><small>{{ row.etfCount }} 檔 ETF · {{ row.stockCount }} 檔股</small>
      </article>
    </section>

    <section class="data-panel">
      <div class="table-title">
        <div><h2><BarChart3 :size="19" /> 台灣個股影響排名</h2><p>正負值同時使用文字與符號呈現，不只依賴顏色。</p></div>
        <label class="market-search"><Search :size="16" /><input v-model="query" type="search" placeholder="搜尋代碼、名稱、產業或 ETF" /></label>
      </div>
      <ResponsiveDataTable label="台灣個股影響排名" :empty="!loading && !displayed.length" empty-text="此日期尚無跨 ETF 異動資料。">
        <div class="desktop-table impact-grid">
          <div class="table-head"><span>股票</span><span>產業</span><span>主動淨變動</span><span>權重變動</span><span>三大法人</span><span>影響 ETF</span><span>主要來源</span></div>
          <div v-for="row in displayed" :id="`market-stock-${row.stockId}`" :key="row.stockId" class="table-row" :class="{ focused: focusStockId === row.stockId }" role="button" tabindex="0" @click="emit('stock', row.stockId)" @keydown.enter.prevent="emit('stock', row.stockId)">
            <span class="stock"><b>{{ row.stockId }}</b><small>{{ row.stockName }}</small></span>
            <span><b>{{ row.sector || "其他" }}</b><small>{{ row.themeTags.slice(0,2).join("、") || "-" }}</small></span>
            <span :class="row.totalActiveDiffLots >= 0 ? 'positive' : 'negative'"><b>{{ directionLabel(row.totalActiveDiffLots) }} {{ formatLots(row.totalActiveDiffLots) }}</b><small>張</small></span>
            <span :class="row.totalDiffWeightPoint >= 0 ? 'positive' : 'negative'"><b>{{ formatSignedPp(row.totalDiffWeightPoint) }}</b></span>
            <span :class="(institutionLots(row) ?? 0) >= 0 ? 'positive' : 'negative'"><b>{{ directionLabel(institutionLots(row), "買超", "賣超") }} {{ formatLots(institutionLots(row)) }}</b><small>張</small></span>
            <span><b>{{ row.etfCount }} 檔</b><small>加 {{ row.increaseEtfCount }} / 減 {{ row.decreaseEtfCount }}</small></span>
            <span><button v-if="row.primaryImpactEtf" type="button" class="inline-link" @click.stop="emit('etf', row.primaryImpactEtf.etfCode)">{{ row.primaryImpactEtf.etfCode }}</button><small>{{ formatMoney(row.market?.turnover) }}</small></span>
          </div>
        </div>
        <template #mobile>
          <MobileDataCard v-for="row in displayed" :id="`market-stock-${row.stockId}`" :key="row.stockId" :label="`${row.stockId} ${row.stockName}`" :tone="row.totalActiveDiffLots > 0 ? 'increase' : row.totalActiveDiffLots < 0 ? 'decrease' : 'neutral'" :open="focusStockId === row.stockId">
            <template #title>{{ row.stockId }} {{ row.stockName }}</template>
            <template #summary>{{ directionLabel(row.totalActiveDiffLots) }} {{ formatLots(row.totalActiveDiffLots) }} 張｜權重 {{ formatSignedPp(row.totalDiffWeightPoint) }}<br />{{ row.increaseEtfCount }} 檔加碼／{{ row.decreaseEtfCount }} 檔減碼｜法人 {{ formatLots(institutionLots(row)) }} 張</template>
            <dl><div><dt>產業／主題</dt><dd>{{ row.sector || "其他" }}｜{{ row.themeTags.join("、") || "-" }}</dd></div><div><dt>成交金額</dt><dd>{{ formatMoney(row.market?.turnover) }}</dd></div><div><dt>主要來源 ETF</dt><dd><button v-for="etf in row.etfs.slice(0,5)" :key="etf.etfCode" type="button" class="chip" @click="emit('etf', etf.etfCode)">{{ etf.etfCode }} {{ formatLots(etf.activeDiffLots ?? etf.diffLots) }} 張</button></dd></div></dl>
          </MobileDataCard>
        </template>
      </ResponsiveDataTable>
    </section>
  </section>
</template>

<style scoped>
.view-shell{display:grid;gap:16px}.view-heading{display:flex;justify-content:space-between;gap:24px;padding:30px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.eyebrow{color:#087b72;font-size:12px;font-weight:850;letter-spacing:.12em}.view-heading h1{margin:8px 0 10px;color:#1d2c38;font-size:32px}.view-heading p{max-width:760px;margin:0;color:#67747f;line-height:1.7}.date-pill{align-self:flex-start;padding:8px 12px;border-radius:999px;background:#eef5f4;color:#176f69;font-size:12px;font-weight:780;white-space:nowrap}.market-sector-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.market-sector-grid article{display:grid;gap:6px;padding:14px;border:1px solid #e0e7ea;border-top:3px solid #7d8993;border-radius:10px;background:#fff}.market-sector-grid article.increase{border-top-color:#cf493e}.market-sector-grid article.decrease{border-top-color:#07847d}.market-sector-grid span,.market-sector-grid small{color:#71808b;font-size:12px}.market-sector-grid strong{color:#27343f;font-size:17px}.data-panel{padding:24px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.table-title{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:16px}.table-title h2{display:flex;align-items:center;gap:8px;margin:0 0 5px;color:#24323e}.table-title p{margin:0;color:#73808b;font-size:13px}.market-search{display:flex;align-items:center;gap:8px;width:min(320px,100%);height:44px;padding:0 12px;border:1px solid #d7e0e4;border-radius:10px}.market-search input{width:100%;border:0;outline:0;background:transparent}.desktop-table{overflow:hidden;border:1px solid #e2e8eb;border-radius:10px}.impact-grid .table-head,.impact-grid .table-row{display:grid;grid-template-columns:1.1fr 1fr 1.2fr .9fr 1.1fr .85fr 1fr;gap:10px;align-items:center}.table-head{padding:11px 13px;background:#f2f6f7;color:#66737e;font-size:12px;font-weight:780}.table-row{width:100%;min-height:72px;padding:10px 13px;border:0;border-top:1px solid #edf1f3;background:#fff;color:#35424d;text-align:left;cursor:pointer}.table-row:hover,.table-row.focused{background:#f3f8f8}.table-row:focus-visible{outline:3px solid rgba(52,89,134,.28);outline-offset:-3px}.table-row>span{display:grid;gap:3px}.table-row small{color:#7a8791}.positive b{color:#ba3e36}.negative b{color:#087b72}.inline-link,.chip{min-height:32px;border:1px solid #cbd8df;border-radius:7px;background:#f7fafb;color:#345986;font-weight:780;cursor:pointer}.chip{margin:3px;padding:5px 8px}.mobile-data-card dl{display:grid;gap:10px;margin:0}.mobile-data-card dl div{display:grid;gap:4px}.mobile-data-card dt{color:#76838d;font-size:11px;font-weight:750}.mobile-data-card dd{margin:0;color:#34424e}.stock b{font-size:15px}
@media(max-width:1100px){.market-sector-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.view-heading{display:grid;padding:20px 16px}.view-heading h1{font-size:28px}.date-pill{justify-self:start}.market-sector-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.data-panel{padding:16px 12px}.table-title{display:grid;align-items:stretch}.market-search{width:100%}}
</style>
