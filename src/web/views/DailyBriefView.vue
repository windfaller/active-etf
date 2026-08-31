<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight, Building2, CircleAlert, GitCompareArrows, Globe2, Layers, Search, TrendingDown, TrendingUp } from "@lucide/vue";
import { configuredEtfs } from "../../config/etfs";
import CoverageStatus from "../components/CoverageStatus.vue";
import DataFreshnessBadge from "../components/DataFreshnessBadge.vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import type { EtfCoverageResponse, SectorSummaryRow, StockImpact } from "../contracts/dashboard";
import { buildDailyBrief, hasDirectionConsensus } from "../domain/dailyBrief";
import { buildPullPushPreview } from "../domain/pullPushRadar";
import { directionLabel, formatLots, formatSigned, formatSignedPp } from "../utils/format";

const props = defineProps<{
  impacts: StockImpact[];
  sectors: SectorSummaryRow[];
  coverage: EtfCoverageResponse | null;
  selectedDate: string;
  isLoading: boolean;
}>();
const emit = defineEmits<{ navigate: [path: string]; stock: [stockId: string] }>();

const brief = computed(() => buildDailyBrief(props.impacts, props.sectors, props.coverage));
const compareOptions = configuredEtfs.filter((row) => row.enabled && ["TWD"].includes(row.currency));
const compareLeft = ref(compareOptions.find((row) => row.etfCode === "00981A")?.etfCode ?? compareOptions[0]?.etfCode ?? "");
const compareRight = ref(compareOptions.find((row) => row.etfCode === "00982A")?.etfCode ?? compareOptions[1]?.etfCode ?? "");
const canQuickCompare = computed(() => Boolean(compareLeft.value && compareRight.value && compareLeft.value !== compareRight.value));
const quickComparePath = computed(() => `/compare/etfs?type=tw&codes=${compareLeft.value},${compareRight.value}`);
const issuerByEtf = new Map(configuredEtfs.map((row) => [row.etfCode, row.issuer]));
const pullPush = computed(() => buildPullPushPreview(props.impacts, props.coverage, props.selectedDate, issuerByEtf));
const freshnessTone = computed(() => brief.value.confidence.level === "high" ? "fresh" : brief.value.confidence.level === "medium" ? "delayed" : "unknown");
const sampleOnly = computed(() => brief.value.confidence.level === "low");

function institutionLabel(row: StockImpact): string {
  const shares = row.institutional?.totalNetShares;
  if (shares === null || shares === undefined) return "法人無資料";
  return `法人${directionLabel(shares, "買超", "賣超")} ${formatLots(shares / 1000)} 張`;
}

function directionClass(value: number | null | undefined): "direction-positive" | "direction-negative" | "direction-neutral" {
  if (value === null || value === undefined || value === 0) return "direction-neutral";
  return value > 0 ? "direction-positive" : "direction-negative";
}
</script>

<template>
  <section class="daily-brief-view">
    <header class="brief-hero">
      <div class="hero-copy">
        <span class="eyebrow">ETF 持倉雷達 · 今日情報</span>
        <h1>主動 ETF 機構調倉情報</h1>
        <p>優先使用可驗證的基金規模校正，追蹤 ETF 主動加減碼與投信方向；資料不足就標示未知。</p>
        <section class="hero-quick-compare" aria-label="首頁 ETF 快速比較">
          <header><GitCompareArrows :size="18" /><div><b>一步開始 ETF 比較</b><small>已預選兩檔，按一次直接看結果</small></div></header>
          <div class="quick-compare-controls">
            <label><span>第一檔</span><select v-model="compareLeft" aria-label="快速比較第一檔 ETF"><option v-for="option in compareOptions" :key="`left-${option.etfCode}`" :value="option.etfCode">{{ option.etfCode }} {{ option.name }}</option></select></label>
            <b aria-hidden="true">×</b>
            <label><span>第二檔</span><select v-model="compareRight" aria-label="快速比較第二檔 ETF"><option v-for="option in compareOptions" :key="`right-${option.etfCode}`" :value="option.etfCode">{{ option.etfCode }} {{ option.name }}</option></select></label>
            <a :href="canQuickCompare ? quickComparePath : '#'" :aria-disabled="!canQuickCompare" :class="{ disabled: !canQuickCompare }" @click="canQuickCompare ? emit('navigate', quickComparePath) : $event.preventDefault()"><span>立即比較 {{ compareLeft }} × {{ compareRight }}</span><ArrowRight :size="17" /></a>
          </div>
          <small v-if="!canQuickCompare" class="quick-compare-warning">請選擇兩檔不同 ETF。</small>
        </section>
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
        <div><span class="section-kicker">DAILY BRIEF</span><h2>{{ sampleOnly ? "目前資料涵蓋不足" : "今日最重要的三件事" }}</h2><span v-if="sampleOnly" class="sample-scope">已更新樣本中</span></div>
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

    <section id="pull-push-radar" class="brief-section pull-push-section" aria-label="拉推 v2.1 前置雷達">
      <div class="brief-heading">
        <div><span class="section-kicker">PULL × PUSH v2.1</span><h2>拉推 v2.1 前置雷達</h2><span class="sample-scope">{{ pullPush.selectedDate || '資料日未知' }} · {{ pullPush.coverageLabel }}</span></div>
        <p>這是資金證據初篩，不是可交易榜。缺任一必要資料就不產生 v2.1 分數。</p>
      </div>
      <div class="radar-readiness" aria-label="v2.1 資料完整度">
        <article v-for="item in pullPush.readiness" :key="item.label" :class="item.status"><span>{{ item.status === 'ready' ? '已接入' : item.status === 'partial' ? '部分' : '待補' }}</span><b>{{ item.label }}</b><small>{{ item.detail }}</small></article>
      </div>
      <div v-if="pullPush.candidates.length" class="pull-push-grid">
        <a v-for="row in pullPush.candidates" :key="row.stockId" :href="`/stocks/tw/${row.stockId}`" @click.prevent="emit('navigate', `/stocks/tw/${row.stockId}`)">
          <header><span :class="row.crossSourceState">{{ row.statusLabel }}</span><small>{{ row.decision }}</small></header>
          <h3>{{ row.stockId }} {{ row.stockName }}</h3>
          <div class="score-gate"><span><small>拉力</small><b>未計分</b></span><span><small>推力 v2.1</small><b>未計分</b></span><span><small>可交易分</small><b>未產生</b></span></div>
          <dl>
            <div><dt>流量校正主動增持</dt><dd :class="directionClass(row.adjustedActiveLots)">{{ formatLots(row.adjustedActiveLots) }} 張</dd></div>
            <div><dt>ETF／跨投信來源</dt><dd>{{ row.activeEtfCount }} 檔／{{ row.issuerCount }} 家</dd></div>
            <div><dt>投信當日買賣超</dt><dd :class="directionClass(row.investmentTrustNetShares)">{{ row.investmentTrustNetShares === null ? '未知' : formatSigned(row.investmentTrustNetShares) + ' 股' }}</dd></div>
            <div><dt>流量校正涵蓋</dt><dd>{{ Math.round(row.flowCorrectionCoverage * 100) }}% ({{ row.adjustedEtfCount }}/{{ row.totalEtfCount }})</dd></div>
          </dl>
          <p><CircleAlert :size="15" />{{ row.blockers[0] }}</p>
          <footer>查看個股證據 <ArrowRight :size="16" /></footer>
        </a>
      </div>
      <p v-else class="brief-empty">當日尚無「流量校正後為正」的可驗證 ETF 初篩候選。</p>
      <footer class="radar-methodology"><span>忠實四榜、single-source cap、manager breadth、freshness 與第二階段交易閘門都會保留；未完成前只能稱「前置雷達」。</span><a href="/methodology" @click.prevent="emit('navigate', '/methodology')">查看方法與限制 <ArrowRight :size="15" /></a></footer>
    </section>

    <section class="brief-section consensus-section">
      <div class="brief-heading">
        <div><span class="section-kicker">CROSS-ETF ACTIONS</span><h2>{{ sampleOnly ? "已更新樣本中的共同加碼／共同減碼" : "今日共同加碼／共同減碼" }}</h2><span v-if="sampleOnly" class="sample-scope">已更新樣本中</span></div>
        <p>至少兩檔同向才列入；占比達 60% 且多於反向才標示為共識。</p>
      </div>
      <div class="consensus-columns">
        <section class="consensus-panel increase">
          <h3><TrendingUp :size="18" /> 共同加碼 <small>{{ brief.additions.length }} 檔</small></h3>
          <button v-for="row in brief.additions" :key="row.stockId" type="button" class="consensus-row" @click="emit('stock', row.stockId)">
            <span class="stock"><b>{{ row.stockId }}</b><small>{{ row.stockName }}</small></span>
            <span><b :class="directionClass(row.totalActiveDiffLots)">主動 {{ formatLots(row.totalActiveDiffLots) }} 張</b><small>{{ row.increaseEtfCount }} 檔 ETF 加碼｜{{ hasDirectionConsensus(row, "increase") ? "達共識門檻" : "共同動作" }}</small></span>
            <span><b :class="directionClass(row.totalDiffWeightPoint)">{{ formatSignedPp(row.totalDiffWeightPoint) }}</b><small :class="directionClass(row.institutional?.totalNetShares)">{{ institutionLabel(row) }}</small></span>
            <ArrowRight :size="16" />
          </button>
          <p v-if="!brief.additions.length" class="list-empty">今日尚無足夠樣本形成共同加碼結論。</p>
        </section>
        <section class="consensus-panel decrease">
          <h3><TrendingDown :size="18" /> 共同減碼 <small>{{ brief.reductions.length }} 檔</small></h3>
          <button v-for="row in brief.reductions" :key="row.stockId" type="button" class="consensus-row" @click="emit('stock', row.stockId)">
            <span class="stock"><b>{{ row.stockId }}</b><small>{{ row.stockName }}</small></span>
            <span><b :class="directionClass(row.totalActiveDiffLots)">主動 {{ formatLots(row.totalActiveDiffLots) }} 張</b><small>{{ row.decreaseEtfCount }} 檔 ETF 減碼｜{{ hasDirectionConsensus(row, "decrease") ? "達共識門檻" : "共同動作" }}</small></span>
            <span><b :class="directionClass(row.totalDiffWeightPoint)">{{ formatSignedPp(row.totalDiffWeightPoint) }}</b><small :class="directionClass(row.institutional?.totalNetShares)">{{ institutionLabel(row) }}</small></span>
            <ArrowRight :size="16" />
          </button>
          <p v-if="!brief.reductions.length" class="list-empty">今日尚無足夠樣本形成共同減碼結論。</p>
        </section>
      </div>
    </section>

    <section class="brief-section">
      <div class="brief-heading">
        <div><span class="section-kicker">SECTOR DIRECTION</span><h2>{{ sampleOnly ? "已更新樣本中的產業方向" : "產業方向" }}</h2><span v-if="sampleOnly" class="sample-scope">已更新樣本中</span></div>
        <p>只保留當日變動最明顯的產業。</p>
      </div>
      <div class="sector-direction-grid">
        <MobileDataCard v-for="row in brief.sectors" :key="row.sector" :label="row.sector" :tone="row.totalActiveDiffLots > 0 ? 'increase' : row.totalActiveDiffLots < 0 ? 'decrease' : 'neutral'" :expandable="false">
          <template #title>{{ row.sector }}</template>
          <template #summary><span class="sector-direction-metric" :class="directionClass(row.totalActiveDiffLots)">主動 {{ formatLots(row.totalActiveDiffLots) }} 張</span><span>｜{{ row.etfCount }} 檔 ETF｜{{ row.stockCount }} 檔股票</span><br /><span class="sector-direction-metric" :class="directionClass(row.totalInstitutionalNetLots)">三大法人 {{ formatLots(row.totalInstitutionalNetLots) }} 張</span></template>
          <p>主要標的：{{ row.topStocks.map((stock) => `${stock.stockId} ${stock.stockName}`).join("、") || "-" }}</p>
        </MobileDataCard>
      </div>
    </section>

    <section class="advanced-entry" aria-label="進階入口">
      <a href="/market" @click.prevent="emit('navigate', '/market')"><Layers :size="20" /><span><b>完整台灣市場總覽</b><small>個股影響、產業與法人明細</small></span><ArrowRight :size="17" /></a>
      <a href="/etf/00981A" @click.prevent="emit('navigate', '/etf/00981A')"><Search :size="20" /><span><b>選擇台灣單檔 ETF</b><small>持股、調倉與折溢價</small></span><ArrowRight :size="17" /></a>
      <a href="/global-etfs" @click.prevent="emit('navigate', '/global-etfs')"><Globe2 :size="20" /><span><b>海外 ETF</b><small>官方持股與持股權重變化</small></span><ArrowRight :size="17" /></a>
      <a href="/institutions" @click.prevent="emit('navigate', '/institutions')"><Building2 :size="20" /><span><b>機構 13F</b><small>季度持倉與延遲說明</small></span><ArrowRight :size="17" /></a>
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
.hero-quick-compare{display:grid;gap:12px;max-width:760px;margin-top:24px;padding:14px;border:1px solid rgba(115,236,222,.28);border-radius:14px;background:rgba(3,24,38,.45);backdrop-filter:blur(8px)}.hero-quick-compare header{display:flex;align-items:center;gap:9px}.hero-quick-compare header div{display:grid;gap:2px}.hero-quick-compare header small{color:#b9d8dc}.quick-compare-controls{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto;align-items:end;gap:8px}.quick-compare-controls label{display:grid;gap:4px}.quick-compare-controls label>span{color:#b9d8dc;font-size:11px;font-weight:780}.quick-compare-controls select{width:100%;height:46px;padding:0 34px 0 10px;border:1px solid rgba(190,235,232,.35);border-radius:9px;background:#fff;color:#173445;font-size:13px}.quick-compare-controls>b{align-self:center;padding-top:18px;color:#70ded2}.quick-compare-controls>a{display:flex;align-items:center;justify-content:center;gap:7px;min-height:46px;padding:0 14px;border-radius:9px;background:#35d5c2;color:#062e36;font-weight:850;text-decoration:none;white-space:nowrap}.quick-compare-controls>a.disabled{opacity:.5;pointer-events:none}.quick-compare-warning{color:#ffd6a0}
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
.sample-scope { display:inline-flex; align-items:center; min-height:28px; margin-top:8px; padding:3px 9px; border:1px solid #e4c575; border-radius:999px; background:#fff9e8; color:#725412; font-size:12px; font-weight:800; }
.insight-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.brief-insight { position:relative; min-height:190px; padding:22px; overflow:hidden; border:1px solid #e0e7ea; border-radius:12px; background:#f8fafb; }
.brief-insight::after { content:""; position:absolute; left:0; right:0; bottom:0; height:4px; background:#7d8993; }.brief-insight.increase::after{background:var(--theme-positive)}.brief-insight.decrease::after{background:var(--theme-negative)}.brief-insight.divergence::after{background:#9a6700}
.brief-insight > span { color:#90a0ad; font-size:12px; font-weight:850; }.brief-insight h3{margin:16px 0 10px;color:#26343f;font-size:18px;line-height:1.4}.brief-insight p{margin:0;color:#61707c;line-height:1.7}
.consensus-columns { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.consensus-panel { overflow:hidden; border:1px solid #e0e7ea; border-radius:12px; }.consensus-panel h3{display:flex;align-items:center;gap:8px;margin:0;padding:15px 17px;background:#f8fafb;color:#26343f}.consensus-panel h3 small{margin-left:auto;color:#65727c;font-size:12px}
.consensus-panel.increase h3{border-top:3px solid var(--theme-positive);color:var(--theme-positive)!important}.consensus-panel.decrease h3{border-top:3px solid var(--theme-negative);color:var(--theme-negative)!important}.consensus-panel h3 small{color:var(--theme-text-muted)!important}
.consensus-row { display:grid; grid-template-columns:minmax(120px,1fr) minmax(160px,1.2fr) minmax(150px,1fr) 20px; align-items:center; gap:12px; width:100%; min-height:70px; padding:10px 16px; border:0; border-top:1px solid #edf1f3; background:#fff; color:#33414c; text-align:left; cursor:pointer; }.consensus-row:hover{background:#f7fafb}.consensus-row:focus-visible{outline:3px solid rgba(52,89,134,.26);outline-offset:-3px}.consensus-row span{display:grid;gap:3px}.consensus-row small{color:#76838e}.consensus-row .stock b{font-size:15px}.consensus-row > svg{color:#75838f}
.direction-positive,.consensus-row small.direction-positive{color:var(--theme-positive)!important;font-weight:800}.direction-negative,.consensus-row small.direction-negative{color:var(--theme-negative)!important;font-weight:800}.direction-neutral{color:var(--theme-text-muted)!important}.sector-direction-metric{display:inline;font-weight:800}
.list-empty,.brief-empty { margin:0; padding:24px; color:#6a7782; text-align:center; }
.sector-direction-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.pull-push-section{display:grid;gap:16px}.radar-readiness{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.radar-readiness article{display:grid;gap:6px;padding:13px;border:1px solid var(--theme-border);border-radius:10px;background:var(--theme-surface-muted)}.radar-readiness article>span{width:max-content;padding:3px 7px;border-radius:999px;background:#edf1f3;color:var(--theme-text-muted);font-size:10px;font-weight:850}.radar-readiness article.ready>span{background:#e9f7f2;color:#14755e}.radar-readiness article.partial>span{background:#fff4dc;color:#8a6106}.radar-readiness b{color:var(--theme-text-strong)}.radar-readiness small{color:var(--theme-text-muted);line-height:1.5}.pull-push-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.pull-push-grid>a{display:grid;gap:12px;padding:17px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface-muted);color:var(--theme-text);text-decoration:none}.pull-push-grid>a:hover{border-color:#7ea0b0;box-shadow:0 10px 28px rgba(29,54,71,.08)}.pull-push-grid header{display:flex;justify-content:space-between;gap:8px}.pull-push-grid header>span{padding:4px 8px;border-radius:999px;background:#edf1f3;color:var(--theme-text-muted);font-size:11px;font-weight:850}.pull-push-grid header>span.aligned{background:var(--theme-positive-soft);color:var(--theme-positive)}.pull-push-grid header>span.divergent{background:#fff4dc;color:#8a6106}.pull-push-grid header small{color:var(--theme-text-muted)}.pull-push-grid h3{margin:0;color:var(--theme-text-strong);font-size:20px}.score-gate{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.score-gate span{display:grid;gap:3px;padding:8px;border-radius:8px;background:var(--theme-surface)}.score-gate small{color:var(--theme-text-muted);font-size:10px}.score-gate b{color:var(--theme-text-strong);font-size:12px}.pull-push-grid dl{display:grid;gap:7px;margin:0}.pull-push-grid dl>div{display:flex;justify-content:space-between;gap:10px}.pull-push-grid dt{color:var(--theme-text-muted);font-size:12px}.pull-push-grid dd{margin:0;color:var(--theme-text-strong);font-size:12px;font-weight:800;text-align:right}.pull-push-grid p{display:flex;gap:6px;margin:0;padding-top:10px;border-top:1px solid var(--theme-border);color:var(--theme-text-muted);font-size:11px;line-height:1.5}.pull-push-grid p svg{flex:0 0 auto}.pull-push-grid>a>footer{display:flex;justify-content:flex-end;align-items:center;gap:5px;color:#345986;font-size:12px;font-weight:800}.radar-methodology{display:flex;justify-content:space-between;gap:16px;padding-top:12px;border-top:1px solid var(--theme-border);color:var(--theme-text-muted);font-size:12px;line-height:1.5}.radar-methodology a{display:flex;align-items:center;gap:5px;flex:0 0 auto;color:#345986;font-weight:800;text-decoration:none}
.sector-direction-grid :deep(.mobile-data-card.increase .mobile-card-title){color:var(--theme-positive)}.sector-direction-grid :deep(.mobile-data-card.decrease .mobile-card-title){color:var(--theme-negative)}
.advanced-entry { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }.advanced-entry button{display:grid;grid-template-columns:24px 1fr 18px;align-items:center;gap:10px;min-height:92px;padding:16px;border:1px solid #dce4e8;border-radius:12px;background:#fff;color:#33414c;text-align:left;cursor:pointer}.advanced-entry button:hover{border-color:#87a1b9;box-shadow:0 8px 24px rgba(38,61,82,.08)}.advanced-entry button:focus-visible{outline:3px solid rgba(52,89,134,.3)}.advanced-entry span{display:grid;gap:4px}.advanced-entry small{color:#65727c;line-height:1.4}
@media (max-width:960px){.brief-hero{grid-template-columns:1fr}.hero-radar{position:absolute;right:-60px;bottom:-80px;opacity:.65}.insight-grid,.sector-direction-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.advanced-entry{grid-template-columns:repeat(2,minmax(0,1fr))}.consensus-columns{grid-template-columns:1fr}.radar-readiness{grid-template-columns:repeat(2,minmax(0,1fr))}.pull-push-grid{grid-template-columns:1fr}}
@media (max-width:760px){.daily-brief-view{gap:12px}.brief-hero{min-height:0;padding:24px 16px;border-radius:14px}.brief-hero h1{font-size:36px}.brief-hero p{font-size:15px}.quick-compare-controls{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.quick-compare-controls>a{grid-column:1 / -1}.brief-section{padding:18px 14px}.brief-heading{display:grid}.brief-heading>p{text-align:left}.insight-grid,.sector-direction-grid,.advanced-entry,.radar-readiness{grid-template-columns:1fr}.brief-insight{min-height:0}.consensus-row{grid-template-columns:1fr 1fr 18px}.consensus-row>span:nth-child(3){grid-column:1 / 3}.advanced-entry button{min-height:78px}.score-gate{grid-template-columns:1fr}.radar-methodology{display:grid}.radar-methodology a{justify-self:start}}
.advanced-entry a{display:grid;grid-template-columns:24px 1fr 18px;align-items:center;gap:10px;min-height:92px;padding:16px;border:1px solid #dce4e8;border-radius:12px;background:#fff;color:#33414c;text-align:left;text-decoration:none}.advanced-entry a:hover{border-color:#87a1b9;box-shadow:0 8px 24px rgba(38,61,82,.08)}.advanced-entry a:focus-visible{outline:3px solid rgba(52,89,134,.3)}.advanced-entry a span{display:grid;gap:4px}.advanced-entry a small{color:#65727c;line-height:1.4}@media(max-width:760px){.advanced-entry a{min-height:78px}}
</style>
