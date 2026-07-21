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
function institutionLotsLabel(row: StockImpact): string { const lots = institutionLots(row); return lots === null ? "-" : `${formatLots(lots)} 張`; }
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
        <header><span>{{ row.sector }}</span><strong>{{ formatLots(row.totalActiveDiffLots) }} 張</strong><small>{{ row.etfCount }} 檔 ETF · {{ row.stockCount }} 檔股</small></header>
        <div v-if="row.topStocks.length" class="sector-stock-list">
          <button v-for="stock in row.topStocks.slice(0,3)" :key="stock.stockId" type="button" @click="emit('stock', stock.stockId)">
            <span><b>{{ stock.stockId }}</b> {{ stock.stockName }}</span>
            <strong :class="stock.totalActiveDiffLots >= 0 ? 'positive' : 'negative'">{{ formatLots(stock.totalActiveDiffLots) }}</strong>
          </button>
        </div>
      </article>
    </section>

    <section class="data-panel">
      <div class="table-title">
        <div><h2><BarChart3 :size="19" /> 台灣個股影響排名</h2></div>
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
          <MobileDataCard v-for="row in displayed" :id="`market-stock-${row.stockId}`" :key="row.stockId" class="market-impact-card" :class="{ 'is-focused': focusStockId === row.stockId }" :label="`${row.stockId} ${row.stockName}`" :tone="row.totalActiveDiffLots > 0 ? 'increase' : row.totalActiveDiffLots < 0 ? 'decrease' : 'neutral'" :expandable="false">
            <template #title>{{ row.stockId }} {{ row.stockName }}</template>
            <template #summary>
              <span class="impact-summary-primary">
                <b :class="row.totalActiveDiffLots >= 0 ? 'positive' : 'negative'">{{ directionLabel(row.totalActiveDiffLots) }} {{ formatLots(row.totalActiveDiffLots) }} 張</b>
                <span>權重 {{ formatSignedPp(row.totalDiffWeightPoint) }}</span>
              </span>
              <span class="impact-summary-secondary">
                <span>加 {{ row.increaseEtfCount }}／減 {{ row.decreaseEtfCount }} 檔</span>
                <span>法人 {{ institutionLotsLabel(row) }}</span>
              </span>
            </template>
            <dl class="impact-card-facts">
              <div class="impact-card-fact">
                <dt>產業／主題</dt>
                <dd><strong>{{ row.sector || "其他" }}</strong><span v-if="row.themeTags.length" class="impact-theme">{{ row.themeTags.join("、") }}</span></dd>
              </div>
              <div class="impact-card-fact">
                <dt>成交金額</dt>
                <dd>{{ formatMoney(row.market?.turnover) }}</dd>
              </div>
              <div class="impact-card-fact impact-card-source">
                <dt>主要來源 ETF</dt>
                <dd class="impact-source-list">
                  <button v-for="etf in row.etfs.slice(0,5)" :key="etf.etfCode" type="button" class="chip source-chip" @click="emit('etf', etf.etfCode)">{{ etf.etfCode }} {{ formatLots(etf.activeDiffLots ?? etf.diffLots) }} 張</button>
                  <span v-if="!row.etfs.length">-</span>
                </dd>
              </div>
            </dl>
          </MobileDataCard>
        </template>
      </ResponsiveDataTable>
    </section>
  </section>
</template>

<style scoped>
.view-shell{display:grid;gap:16px}.view-heading{display:flex;justify-content:space-between;gap:24px;padding:30px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.eyebrow{color:#087b72;font-size:12px;font-weight:850;letter-spacing:.12em}.view-heading h1{margin:8px 0 10px;color:#1d2c38;font-size:32px}.view-heading p{max-width:760px;margin:0;color:#67747f;line-height:1.7}.date-pill{align-self:flex-start;padding:8px 12px;border-radius:999px;background:#eef5f4;color:#176f69;font-size:12px;font-weight:780;white-space:nowrap}.market-sector-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.market-sector-grid article{display:grid;align-content:start;gap:10px;padding:14px;border:1px solid #e0e7ea;border-top:3px solid #7d8993;border-radius:10px;background:#fff}.market-sector-grid article.increase{border-top-color:#cf493e}.market-sector-grid article.decrease{border-top-color:#07847d}.market-sector-grid article>header{display:grid;gap:5px}.market-sector-grid span,.market-sector-grid small{color:#71808b;font-size:12px}.market-sector-grid article>header>strong{color:#27343f;font-size:17px}.sector-stock-list{display:grid;gap:5px;padding-top:8px;border-top:1px solid var(--theme-border)}.sector-stock-list button{display:flex;justify-content:space-between;align-items:center;gap:10px;min-width:0;min-height:34px;padding:5px 7px;border:0;border-radius:7px;background:var(--theme-surface-muted);color:var(--theme-text);text-align:left;cursor:pointer}.sector-stock-list button:hover{filter:brightness(.97)}.sector-stock-list button>span{min-width:0;overflow:hidden;color:var(--theme-text);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.sector-stock-list button>strong{flex:0 0 auto;font-size:12px}.sector-stock-list .positive{color:#ba3e36}.sector-stock-list .negative{color:#087b72}.data-panel{padding:24px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.table-title{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:16px}.table-title h2{display:flex;align-items:center;gap:8px;margin:0 0 5px;color:#24323e}.market-search{display:flex;align-items:center;gap:8px;width:min(320px,100%);height:44px;padding:0 12px;border:1px solid #d7e0e4;border-radius:10px}.market-search input{width:100%;border:0;outline:0;background:transparent}.desktop-table{overflow:hidden;border:1px solid #e2e8eb;border-radius:10px}.impact-grid .table-head,.impact-grid .table-row{display:grid;grid-template-columns:1.1fr 1fr 1.2fr .9fr 1.1fr .85fr 1fr;gap:10px;align-items:center}.table-head{padding:11px 13px;background:#f2f6f7;color:#66737e;font-size:12px;font-weight:780}.table-row{width:100%;min-height:72px;padding:10px 13px;border:0;border-top:1px solid #edf1f3;background:#fff;color:#35424d;text-align:left;cursor:pointer}.table-row:hover,.table-row.focused{background:#f3f8f8}.table-row:focus-visible{outline:3px solid rgba(52,89,134,.28);outline-offset:-3px}.table-row>span{display:grid;gap:3px}.table-row small{color:#7a8791}.positive b{color:#ba3e36}.negative b{color:#087b72}.inline-link,.chip{min-height:32px;border:1px solid #cbd8df;border-radius:7px;background:#f7fafb;color:#345986;font-weight:780;cursor:pointer}.chip{margin:3px;padding:5px 8px}.market-impact-card.mobile-data-card{border-left-width:1px}.market-impact-card.increase{--impact-card-accent:#9d3129;--impact-card-bg:#fff1ef;--impact-card-detail-bg:#ffe7e3;--impact-card-border:#e4aaa4;border-color:var(--impact-card-border);background:var(--impact-card-bg)}.market-impact-card.decrease{--impact-card-accent:#086c64;--impact-card-bg:#eefaf7;--impact-card-detail-bg:#e0f4ef;--impact-card-border:#91c9c1;border-color:var(--impact-card-border);background:var(--impact-card-bg)}.market-impact-card.neutral{--impact-card-accent:var(--theme-text);--impact-card-bg:var(--theme-surface);--impact-card-detail-bg:var(--theme-surface-muted);--impact-card-border:var(--theme-border)}.market-impact-card.is-focused{box-shadow:0 0 0 2px rgba(52,89,134,.36)}.market-impact-card :deep(.mobile-card-static-content){gap:5px;padding:13px 14px 11px}.market-impact-card :deep(.mobile-card-title){color:var(--impact-card-accent);font-size:16px;line-height:1.35}.market-impact-card :deep(.mobile-card-summary){display:grid;gap:4px;font-size:13px;line-height:1.45}.market-impact-card :deep(.mobile-card-detail-static){padding:10px 14px 13px;border-top:1px solid var(--impact-card-border);background:var(--impact-card-detail-bg)}.impact-summary-primary,.impact-summary-secondary{display:flex;flex-wrap:wrap;gap:3px 12px}.impact-summary-primary{color:var(--theme-text);font-weight:680}.impact-summary-primary b{color:var(--impact-card-accent);font-weight:820}.impact-summary-secondary{color:var(--theme-text-muted);font-weight:620}.impact-card-facts{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(88px,.6fr);gap:9px 14px;margin:0}.impact-card-fact{display:grid;align-content:start;gap:3px;min-width:0}.impact-card-fact dt{color:var(--theme-text-muted);font-size:12px;font-weight:820}.impact-card-fact dd{margin:0;color:var(--theme-text);font-size:13px;font-weight:680;line-height:1.4;overflow-wrap:anywhere}.impact-card-fact dd strong{font-weight:820}.impact-theme{color:var(--theme-text-muted);font-weight:620}.impact-theme::before{content:"·";margin:0 5px}.impact-card-source{grid-column:1/-1}.impact-source-list{display:flex;flex-wrap:wrap;gap:6px}.source-chip{margin:0;padding:6px 9px}.stock b{font-size:15px}
@media(max-width:1100px){.market-sector-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.view-heading{display:grid;padding:20px 16px}.view-heading h1{font-size:28px}.date-pill{justify-self:start}.market-sector-grid{grid-template-columns:1fr}.sector-stock-list button{min-height:40px}.data-panel{padding:16px 12px}.table-title{display:grid;align-items:stretch}.market-search{width:100%}}
</style>
