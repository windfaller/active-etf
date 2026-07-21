<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Building2, Globe2, Layers, Search, TrendingDown, TrendingUp } from "@lucide/vue";
import CoverageStatus from "../components/CoverageStatus.vue";
import DataFreshnessBadge from "../components/DataFreshnessBadge.vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import type { EtfCoverageResponse, SectorSummaryRow, StockImpact } from "../contracts/dashboard";
import { buildDailyBrief } from "../domain/dailyBrief";
import { directionLabel, formatLots, formatSignedPp } from "../utils/format";

const props = defineProps<{
  impacts: StockImpact[];
  sectors: SectorSummaryRow[];
  coverage: EtfCoverageResponse | null;
  selectedDate: string;
  isLoading: boolean;
}>();
const emit = defineEmits<{ navigate: [path: string]; stock: [stockId: string] }>();

const brief = computed(() => buildDailyBrief(props.impacts, props.sectors, props.coverage));
const freshnessTone = computed(() => brief.value.confidence.level === "high" ? "fresh" : brief.value.confidence.level === "medium" ? "delayed" : "unknown");

function institutionLabel(row: StockImpact): string {
  const shares = row.institutional?.totalNetShares;
  if (shares === null || shares === undefined) return "法人無資料";
  return `法人${directionLabel(shares, "買超", "賣超")} ${formatLots(shares / 1000)} 張`;
}
</script>

<template>
  <section class="daily-brief-view">
    <header class="brief-hero">
      <div class="hero-copy">
        <span class="eyebrow">ETF 持倉雷達 · 今日情報</span>
        <h1>主動 ETF 機構調倉情報</h1>
        <p>排除基金規模變化，追蹤經理人真正的加碼、減碼與跨 ETF 共識。</p>
        <div class="hero-badges">
          <DataFreshnessBadge :label="`資料日 ${selectedDate || '載入中'}`" :tone="freshnessTone" />
          <DataFreshnessBadge :label="`最後更新 ${brief.latestUpdatedAt ? new Date(brief.latestUpdatedAt).toLocaleString('zh-TW', { hour12: false }) : '-'}`" :tone="freshnessTone" />
        </div>
      </div>
      <div class="hero-radar" aria-hidden="true"><i></i><i></i><i></i><b></b></div>
    </header>

    <CoverageStatus :coverage="coverage" :sample-count="impacts.length" />

    <section class="brief-section">
      <div class="brief-heading">
        <div><span class="section-kicker">DAILY BRIEF</span><h2>今日最重要的三件事</h2></div>
        <p>中性研究摘要，不構成買賣建議。</p>
      </div>
      <div v-if="brief.insights.length" class="insight-grid">
        <article v-for="(insight, index) in brief.insights" :key="insight.id" :class="['brief-insight', insight.tone]">
          <span>0{{ index + 1 }}</span>
          <h3>{{ insight.title }}</h3>
          <p>{{ insight.description }}</p>
        </article>
      </div>
      <div v-else-if="isLoading" class="brief-empty" role="status">正在整理今日公開資料…</div>
    </section>

    <section class="brief-section consensus-section">
      <div class="brief-heading">
        <div><span class="section-kicker">CROSS-ETF CONSENSUS</span><h2>今日共同加碼／共同減碼</h2></div>
        <p>至少兩檔 ETF 同向調整才列入。</p>
      </div>
      <div class="consensus-columns">
        <section class="consensus-panel increase">
          <h3><TrendingUp :size="18" /> 共同加碼 <small>{{ brief.additions.length }} 檔</small></h3>
          <button v-for="row in brief.additions" :key="row.stockId" type="button" class="consensus-row" @click="emit('stock', row.stockId)">
            <span class="stock"><b>{{ row.stockId }}</b><small>{{ row.stockName }}</small></span>
            <span><b>主動 {{ formatLots(row.totalActiveDiffLots) }} 張</b><small>{{ row.increaseEtfCount }} 檔 ETF 加碼</small></span>
            <span><b>{{ formatSignedPp(row.totalDiffWeightPoint) }}</b><small>{{ institutionLabel(row) }}</small></span>
            <ArrowRight :size="16" />
          </button>
          <p v-if="!brief.additions.length" class="list-empty">今日尚無足夠樣本形成共同加碼結論。</p>
        </section>
        <section class="consensus-panel decrease">
          <h3><TrendingDown :size="18" /> 共同減碼 <small>{{ brief.reductions.length }} 檔</small></h3>
          <button v-for="row in brief.reductions" :key="row.stockId" type="button" class="consensus-row" @click="emit('stock', row.stockId)">
            <span class="stock"><b>{{ row.stockId }}</b><small>{{ row.stockName }}</small></span>
            <span><b>主動 {{ formatLots(row.totalActiveDiffLots) }} 張</b><small>{{ row.decreaseEtfCount }} 檔 ETF 減碼</small></span>
            <span><b>{{ formatSignedPp(row.totalDiffWeightPoint) }}</b><small>{{ institutionLabel(row) }}</small></span>
            <ArrowRight :size="16" />
          </button>
          <p v-if="!brief.reductions.length" class="list-empty">今日尚無足夠樣本形成共同減碼結論。</p>
        </section>
      </div>
    </section>

    <section class="brief-section">
      <div class="brief-heading">
        <div><span class="section-kicker">SECTOR DIRECTION</span><h2>產業方向</h2></div>
        <p>只保留當日變動最明顯的產業。</p>
      </div>
      <div class="sector-direction-grid">
        <MobileDataCard v-for="row in brief.sectors" :key="row.sector" :label="row.sector" :tone="row.totalActiveDiffLots > 0 ? 'increase' : row.totalActiveDiffLots < 0 ? 'decrease' : 'neutral'">
          <template #title>{{ row.sector }}</template>
          <template #summary>主動 {{ formatLots(row.totalActiveDiffLots) }} 張｜{{ row.etfCount }} 檔 ETF｜{{ row.stockCount }} 檔股票</template>
          <p>三大法人 {{ formatLots(row.totalInstitutionalNetLots) }} 張</p>
          <p>主要標的：{{ row.topStocks.map((stock) => `${stock.stockId} ${stock.stockName}`).join("、") || "-" }}</p>
        </MobileDataCard>
      </div>
    </section>

    <section class="advanced-entry" aria-label="進階入口">
      <button type="button" @click="emit('navigate', '/market')"><Layers :size="20" /><span><b>完整台灣市場總覽</b><small>個股影響、產業與法人明細</small></span><ArrowRight :size="17" /></button>
      <button type="button" @click="emit('navigate', '/etf/00981A')"><Search :size="20" /><span><b>選擇台灣單檔 ETF</b><small>持股、調倉與折溢價</small></span><ArrowRight :size="17" /></button>
      <button type="button" @click="emit('navigate', '/global-etfs')"><Globe2 :size="20" /><span><b>海外 ETF</b><small>官方持股與持股權重變化</small></span><ArrowRight :size="17" /></button>
      <button type="button" @click="emit('navigate', '/institutions')"><Building2 :size="20" /><span><b>機構 13F</b><small>季度持倉與延遲說明</small></span><ArrowRight :size="17" /></button>
    </section>
  </section>
</template>

<style scoped>
.daily-brief-view { display:grid; gap:18px; }
.brief-hero { position:relative; display:grid; grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr); min-height:330px; overflow:hidden; padding:42px; border-radius:18px; background:linear-gradient(125deg,#071f36 0%,#0a3345 58%,#075b5c 100%); color:white; box-shadow:0 18px 50px rgba(7,31,54,.16); }
.hero-copy { position:relative; z-index:2; align-self:center; max-width:760px; }
.eyebrow,.section-kicker { color:#30d4bf; font-size:12px; font-weight:850; letter-spacing:.14em; }
.brief-hero h1 { max-width:680px; margin:14px 0 16px; font-size:clamp(34px,4.6vw,58px); line-height:1.08; letter-spacing:-.04em; }
.brief-hero p { max-width:650px; margin:0; color:#d7e8ec; font-size:18px; line-height:1.7; }
.hero-badges { display:flex; flex-wrap:wrap; gap:8px; margin-top:28px; }
.hero-radar { position:relative; align-self:center; justify-self:center; width:260px; aspect-ratio:1; border:1px solid rgba(79,233,215,.22); border-radius:50%; background:radial-gradient(circle,rgba(30,213,191,.18),transparent 58%); }
.hero-radar i { position:absolute; inset:14%; border:1px solid rgba(79,233,215,.25); border-radius:50%; }.hero-radar i:nth-child(2){inset:29%}.hero-radar i:nth-child(3){inset:44%}
.hero-radar::before,.hero-radar::after { content:""; position:absolute; background:rgba(79,233,215,.2); }.hero-radar::before{left:50%;top:0;width:1px;height:100%}.hero-radar::after{top:50%;left:0;width:100%;height:1px}
.hero-radar b { position:absolute; inset:50% 0 0 50%; transform-origin:0 0; transform:rotate(-28deg); border-top:2px solid #2ee1c7; filter:drop-shadow(0 0 8px #2ee1c7); }
.brief-section { padding:28px; border:1px solid #dfe6e9; border-radius:14px; background:#fff; }
.brief-heading { display:flex; justify-content:space-between; gap:20px; margin-bottom:18px; }
.brief-heading h2 { margin:5px 0 0; color:#1e2c38; font-size:24px; }
.brief-heading > p { max-width:380px; margin:0; color:#687580; line-height:1.6; text-align:right; }
.section-kicker { color:#54708a; }
.insight-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.brief-insight { position:relative; min-height:190px; padding:22px; overflow:hidden; border:1px solid #e0e7ea; border-radius:12px; background:#f8fafb; }
.brief-insight::after { content:""; position:absolute; left:0; right:0; bottom:0; height:4px; background:#7d8993; }.brief-insight.increase::after{background:#cf493e}.brief-insight.decrease::after{background:#07847d}.brief-insight.divergence::after{background:#9a6700}
.brief-insight > span { color:#90a0ad; font-size:12px; font-weight:850; }.brief-insight h3{margin:16px 0 10px;color:#26343f;font-size:18px;line-height:1.4}.brief-insight p{margin:0;color:#61707c;line-height:1.7}
.consensus-columns { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.consensus-panel { overflow:hidden; border:1px solid #e0e7ea; border-radius:12px; }.consensus-panel h3{display:flex;align-items:center;gap:8px;margin:0;padding:15px 17px;background:#f8fafb;color:#26343f}.consensus-panel h3 small{margin-left:auto;color:#76838e;font-size:12px}
.consensus-panel.increase h3{border-top:3px solid #cf493e}.consensus-panel.decrease h3{border-top:3px solid #07847d}
.consensus-row { display:grid; grid-template-columns:minmax(120px,1fr) minmax(160px,1.2fr) minmax(150px,1fr) 20px; align-items:center; gap:12px; width:100%; min-height:70px; padding:10px 16px; border:0; border-top:1px solid #edf1f3; background:#fff; color:#33414c; text-align:left; cursor:pointer; }.consensus-row:hover{background:#f7fafb}.consensus-row:focus-visible{outline:3px solid rgba(52,89,134,.26);outline-offset:-3px}.consensus-row span{display:grid;gap:3px}.consensus-row small{color:#76838e}.consensus-row .stock b{font-size:15px}.consensus-row > svg{color:#75838f}
.list-empty,.brief-empty { margin:0; padding:24px; color:#6a7782; text-align:center; }
.sector-direction-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.advanced-entry { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }.advanced-entry button{display:grid;grid-template-columns:24px 1fr 18px;align-items:center;gap:10px;min-height:92px;padding:16px;border:1px solid #dce4e8;border-radius:12px;background:#fff;color:#33414c;text-align:left;cursor:pointer}.advanced-entry button:hover{border-color:#87a1b9;box-shadow:0 8px 24px rgba(38,61,82,.08)}.advanced-entry button:focus-visible{outline:3px solid rgba(52,89,134,.3)}.advanced-entry span{display:grid;gap:4px}.advanced-entry small{color:#74818c;line-height:1.4}
@media (max-width:960px){.brief-hero{grid-template-columns:1fr}.hero-radar{position:absolute;right:-60px;bottom:-80px;opacity:.65}.insight-grid,.sector-direction-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.advanced-entry{grid-template-columns:repeat(2,minmax(0,1fr))}.consensus-columns{grid-template-columns:1fr}}
@media (max-width:760px){.daily-brief-view{gap:12px}.brief-hero{min-height:360px;padding:28px 20px;border-radius:14px}.brief-hero h1{font-size:38px}.brief-hero p{font-size:16px}.brief-section{padding:18px 14px}.brief-heading{display:grid}.brief-heading>p{text-align:left}.insight-grid,.sector-direction-grid,.advanced-entry{grid-template-columns:1fr}.brief-insight{min-height:0}.consensus-row{grid-template-columns:1fr 1fr 18px}.consensus-row>span:nth-child(3){grid-column:1 / 3}.advanced-entry button{min-height:78px}}
</style>
