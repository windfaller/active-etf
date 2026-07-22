<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { GitCompareArrows, Layers3 } from "@lucide/vue";
import { configuredEtfs } from "../../config/etfs";
import { enabledGlobalEtfs } from "../../config/globalEtfs";
import IntelligenceMetaStrip from "../components/IntelligenceMetaStrip.vue";
import GlobalDateAlignmentNotice from "../components/GlobalDateAlignmentNotice.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import { useEtfComparison } from "../composables/useEtfComparison";
import { formatMoney, formatNumber, formatSignedPp, formatWeight } from "../utils/format";

const props = defineProps<{ type: "tw" | "global"; codes: string[]; refreshKey?: number }>();
const emit = defineEmits<{ navigate: [path: string] }>();
const selectedType = ref(props.type);
const defaultCodes = (type: "tw" | "global"): string[] => {
  const preferred = type === "tw" ? ["00981A", "00982A"] : ["DRAM", "HBMX"];
  const available = type === "tw"
    ? configuredEtfs.filter((row) => row.enabled).map((row) => row.etfCode)
    : enabledGlobalEtfs.filter((row) => row.enabled && row.strategyType !== "13f").map((row) => row.etfCode);
  const defaults = preferred.filter((code) => available.includes(code));
  return defaults.length >= 2 ? defaults : available.slice(0, 2);
};
const effectiveCodes = (type: "tw" | "global", codes: string[]): string[] => codes.length ? [...codes] : defaultCodes(type);
const selectedCodes = ref<string[]>(effectiveCodes(props.type, props.codes));
const metric = ref<"overview" | "holdings" | "sectors" | "activity">("overview");
const { comparison, loading, error, load, abort } = useEtfComparison();
const options = computed(() => selectedType.value === "tw"
  ? configuredEtfs.filter((row) => row.enabled).map((row) => ({ code: row.etfCode, name: row.name }))
  : enabledGlobalEtfs.filter((row) => row.enabled && row.strategyType !== "13f").map((row) => ({ code: row.etfCode, name: row.fundName })));
const canCompare = computed(() => selectedCodes.value.length >= 2 && selectedCodes.value.length <= 4);
const globalDateAlignment = computed(() => comparison.value?.type === "global" ? comparison.value.dateAlignment : undefined);
const formatFetchedAt = (value?: string | null) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "未知";

function toggleCode(code: string): void {
  selectedCodes.value = selectedCodes.value.includes(code) ? selectedCodes.value.filter((value) => value !== code) : selectedCodes.value.length < 4 ? [...selectedCodes.value, code] : selectedCodes.value;
}
function changeType(type: "tw" | "global"): void {
  selectedType.value = type;
  selectedCodes.value = defaultCodes(type);
  comparison.value = null;
  if (canCompare.value) void load(type, selectedCodes.value);
}
function apply(): void { if (canCompare.value) emit("navigate", `/compare/etfs?type=${selectedType.value}&codes=${selectedCodes.value.join(',')}`); }

watch(() => [props.type, props.codes.join(","), props.refreshKey], () => {
  const codes = effectiveCodes(props.type, props.codes);
  selectedType.value = props.type;
  selectedCodes.value = codes;
  if (codes.length >= 2 && codes.length <= 4) void load(props.type, codes);
}, { immediate: true });
onBeforeUnmount(abort);
</script>

<template>
  <section class="compare-view">
    <header class="compare-hero"><span>ETF 多檔比較</span><h1>持股重疊、調倉與配置差異</h1><p>同一次比較只使用台灣 ETF 或海外 ETF；13F 不屬於 ETF，無法加入。最多 4 檔，結果網址可分享。</p></header>
    <section class="compare-builder"><div class="type-toggle"><button type="button" :class="{active:selectedType==='tw'}" @click="changeType('tw')">台灣主動 ETF</button><button type="button" :class="{active:selectedType==='global'}" @click="changeType('global')">海外 ETF</button></div><div class="code-options"><button v-for="option in options" :key="option.code" type="button" :class="{selected:selectedCodes.includes(option.code)}" :aria-pressed="selectedCodes.includes(option.code)" @click="toggleCode(option.code)"><b>{{ option.code }}</b><small>{{ option.name }}</small></button></div><footer><span>已選 {{ selectedCodes.length }} / 4 檔</span><button type="button" :disabled="!canCompare" @click="apply"><GitCompareArrows :size="17" />比較 ETF</button></footer></section>
    <p v-if="error" class="compare-error">{{ error }}</p><p v-else-if="loading && !comparison" class="compare-state">比較資料載入中…</p>
    <IntelligenceMetaStrip v-if="comparison" :source-as-of="comparison.sourceAsOf" :generated-at="comparison.generatedAt" :coverage="comparison.coverage" :confidence="comparison.confidence" />
    <GlobalDateAlignmentNotice v-if="comparison?.type === 'global' && globalDateAlignment" :alignment="globalDateAlignment" />

    <nav v-if="comparison" class="metric-selector" aria-label="比較指標"><button v-for="item in [{id:'overview',label:'摘要'},{id:'holdings',label:'持股'},{id:'sectors',label:'產業'},{id:'activity',label:'調整'}]" :key="item.id" type="button" :class="{active:metric===item.id}" @click="metric=item.id as typeof metric">{{ item.label }}</button></nav>

    <section v-if="comparison" class="etf-card-grid">
      <article v-for="card in comparison.cards" :key="card.code" class="etf-card"><header><span>{{ comparison.type === 'tw' ? '台灣 ETF' : '海外 ETF' }}</span><h2>{{ card.code }} {{ card.name }}</h2><small>{{ card.issuer }}｜持股資料日 {{ card.sourceAsOf ?? '-' }}</small><small v-if="comparison.type === 'global'">最後抓取 {{ formatFetchedAt(card.fetchedAt) }}</small></header><div v-if="metric==='overview'" class="card-metrics"><span>基金規模 <b>{{ formatMoney(card.fundSize) }}</b></span><span>持股數 <b>{{ card.holdingCount }}</b></span><span>前十大集中度 <b>{{ formatWeight(card.top10Concentration) }}</b></span><span>HHI <b>{{ formatNumber(card.hhi,4) }}</b></span><span v-if="comparison.type==='tw'">折溢價 <b>{{ formatSignedPp(card.premiumDiscount) }}</b></span></div><div v-else-if="metric==='holdings'" class="rank-list"><span v-for="holding in card.topHoldings.slice(0,8)" :key="holding.key"><b>{{ holding.symbol }} {{ holding.name }}</b><small>{{ holding.assetType }}｜{{ formatWeight(holding.weight) }}</small></span></div><div v-else-if="metric==='sectors'" class="rank-list"><span v-for="sector in card.sectorExposure.slice(0,8)" :key="sector.sector"><b>{{ sector.sector }}</b><small>{{ formatWeight(sector.weight) }}</small></span><template v-if="card.assetComposition"><span v-for="asset in card.assetComposition" :key="asset.assetType"><b>{{ asset.assetType }}</b><small>{{ formatWeight(asset.weight) }}</small></span></template></div><div v-else class="rank-list"><template v-if="card.activeAdjustments"><span v-for="item in card.activeAdjustments" :key="item.window"><b>{{ item.window }} 日主動 {{ formatNumber(item.cumulativeActiveNetLots) }} 張</b><small>調整強度 {{ formatNumber(item.adjustmentIntensity,2) }}｜加碼持股筆數 {{ item.increaseHoldingChangeCount }}｜減碼持股筆數 {{ item.decreaseHoldingChangeCount }}</small></span><span><b>新增 {{ card.addedHoldings }}／退出 {{ card.exitedHoldings }}</b><small>當期調整廣度</small></span></template><span v-else><b>權重調整強度 {{ formatNumber(card.weightAdjustmentIntensity,2) }}</b><small>Σ |weight change| / 2</small></span></div></article>
    </section>

    <section v-if="comparison" class="pairwise-panel"><div class="section-title"><Layers3 :size="20" /><div><h2>Pairwise 重疊矩陣</h2><p>手機使用比較卡，不需要橫向捲動四檔寬表格。</p></div></div><div class="pair-grid"><article v-for="pair in comparison.pairwise" :key="`${pair.left}-${pair.right}`"><header><b>{{ pair.left }} × {{ pair.right }}</b><span>共同 {{ pair.intersectionCount }} / 聯集 {{ pair.unionCount }}</span></header><div><span>Jaccard</span><strong>{{ pair.similarity === null ? '-' : formatNumber(pair.similarity * 100,1) + '%' }}</strong></div><div><span>權重重疊</span><strong>{{ formatWeight(pair.weightedOverlap) }}</strong></div><details><summary>共同持股 {{ pair.common.length }} 檔</summary><p v-for="holding in pair.common" :key="holding.key"><b>{{ holding.label }}</b><span>{{ pair.left }} {{ formatWeight(holding.leftWeight) }}｜{{ pair.right }} {{ formatWeight(holding.rightWeight) }}</span></p></details></article></div></section>
    <SourceDisclosure v-if="comparison" :note="`${comparison.methodology.setOverlap}；${comparison.methodology.weightedOverlap}。${comparison.methodology.missingWeight}。${comparison.methodology.exposureIdentity}`" />
  </section>
</template>

<style scoped>
.compare-view{display:grid;gap:16px}.compare-hero{padding:28px;border-radius:15px;background:linear-gradient(135deg,#102f46,#0c6b65);color:#fff}.compare-hero>span{color:#69e2d5;font-size:12px;font-weight:850;letter-spacing:.13em}.compare-hero h1{margin:8px 0;font-size:34px}.compare-hero p{max-width:850px;margin:0;color:#d8ecec;line-height:1.7}.compare-builder,.pairwise-panel{display:grid;gap:14px;padding:20px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.type-toggle{display:flex;gap:6px}.type-toggle button,.metric-selector button{min-height:42px;padding:0 14px;border:1px solid var(--theme-border);border-radius:9px;background:var(--theme-surface);color:var(--theme-text-muted);font-weight:760}.type-toggle button.active,.metric-selector button.active{border-color:#173f56;background:#173f56;color:#fff}.code-options{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:58px;gap:7px;max-height:253px;overflow:auto;scrollbar-gutter:stable}.code-options button{display:grid;gap:3px;min-height:58px;padding:9px;border:1px solid var(--theme-border);border-radius:9px;background:var(--theme-surface-muted);color:var(--theme-text);text-align:left}.code-options button.selected{border-color:#087b72;background:#edf8f6;color:#0c4d49}.code-options button.selected small{color:#315f5b}.code-options small{overflow:hidden;color:var(--theme-text-muted);text-overflow:ellipsis;white-space:nowrap}.compare-builder footer{display:flex;justify-content:space-between;align-items:center;color:var(--theme-text-muted)}.compare-builder footer button{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 15px;border:0;border-radius:9px;background:#0b766f;color:#fff;font-weight:780}.compare-builder footer button:disabled{opacity:.45}.metric-selector{display:flex;gap:6px;overflow:auto}.etf-card-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.etf-card{display:grid;gap:14px;padding:18px;border:1px solid var(--theme-border);border-radius:13px;background:var(--theme-surface)}.etf-card header{display:grid;gap:4px}.etf-card header>span{color:#087b72;font-size:11px;font-weight:800}.etf-card h2{margin:0;color:var(--theme-text-strong);font-size:19px}.etf-card small{color:var(--theme-text-muted)}.card-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.card-metrics span,.rank-list>span{display:grid;gap:4px;padding:9px;border-radius:8px;background:var(--theme-surface-muted);color:var(--theme-text-muted);font-size:12px}.card-metrics b,.rank-list b{color:var(--theme-text-strong);font-size:14px}.rank-list{display:grid;gap:5px}.section-title{display:flex;gap:9px}.section-title h2{margin:0 0 4px;color:var(--theme-text-strong)}.section-title p{margin:0;color:var(--theme-text-muted)}.pair-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.pair-grid>article{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:15px;border:1px solid var(--theme-border);border-radius:11px}.pair-grid header,.pair-grid details{grid-column:1 / -1}.pair-grid header{display:flex;justify-content:space-between;gap:8px}.pair-grid header span,.pair-grid div span,.pair-grid details span{color:var(--theme-text-muted);font-size:12px}.pair-grid div{display:grid;gap:3px}.pair-grid strong{font-size:20px}.pair-grid summary{min-height:38px;padding-top:10px;border-top:1px solid var(--theme-border);cursor:pointer;color:#345986;font-weight:760}.pair-grid details p{display:flex;justify-content:space-between;gap:10px;margin:0;padding:7px 0;border-bottom:1px solid var(--theme-border);font-size:12px}.compare-error{padding:13px;border:1px solid #f1c4c0;border-radius:10px;background:#fff4f3;color:#a8322a}.compare-state{color:var(--theme-text-muted)}
@media(max-width:850px){.code-options{grid-template-columns:repeat(2,1fr)}.pair-grid{grid-template-columns:1fr}}
@media(max-width:650px){.compare-hero{padding:23px 18px}.compare-hero h1{font-size:28px}.compare-builder{padding:15px 12px}.etf-card-grid{grid-template-columns:1fr}.card-metrics{grid-template-columns:1fr 1fr}.pairwise-panel{padding:16px 12px}.pair-grid>article{grid-template-columns:1fr}.pair-grid header,.pair-grid details{grid-column:auto}.pair-grid header{display:grid}.pair-grid details p{display:grid}}
</style>
