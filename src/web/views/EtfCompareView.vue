<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { GitCompareArrows, Layers3 } from "@lucide/vue";
import { configuredEtfs } from "../../config/etfs";
import { enabledGlobalEtfs } from "../../config/globalEtfs";
import IntelligenceMetaStrip from "../components/IntelligenceMetaStrip.vue";
import MemberLockedResult from "../components/MemberLockedResult.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import { comparisonRequests } from "../analytics";
import { useAuth } from "../composables/useAuth";
import { useEtfComparison } from "../composables/useEtfComparison";
import { isMemberLockedResult, shouldRenderMemberLock } from "../domain/memberVisibility";
import { formatMoney, formatNumber, formatSignedPp, formatWeight, valueTone } from "../utils/format";

const props = defineProps<{ type: "tw" | "global"; codes: string[]; refreshKey?: number }>();
const emit = defineEmits<{ navigate: [path: string] }>();
const { isAuthenticated, signIn, signUp } = useAuth();
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
type Metric = "overview" | "holdings" | "sectors" | "activity";
const initialMetric = new URLSearchParams(window.location.search).get("metric");
const metric = ref<Metric>(["holdings", "sectors", "activity"].includes(initialMetric ?? "") ? initialMetric as Metric : "overview");
const { comparison, loading, error, load, abort } = useEtfComparison();
const options = computed(() => selectedType.value === "tw"
  ? configuredEtfs.filter((row) => row.enabled).map((row) => ({ code: row.etfCode, name: row.name }))
  : enabledGlobalEtfs.filter((row) => row.enabled && row.strategyType !== "13f").map((row) => ({ code: row.etfCode, name: row.fundName })));
const canCompare = computed(() => selectedCodes.value.length >= 2 && selectedCodes.value.length <= 4);
const hasPreset = computed(() => props.codes.length >= 2 && props.codes.length <= 4 && new Set(props.codes).size === props.codes.length && props.codes.every(code => (props.type === 'tw' ? configuredEtfs.filter(row => row.enabled).map(row => row.etfCode) : enabledGlobalEtfs.filter(row => row.enabled && row.strategyType !== '13f').map(row => row.etfCode)).includes(code)));
const builderOpen = ref(!hasPreset.value);
const visiblePairs = computed(() => comparison.value?.pairwise.filter(pair => !isMemberLockedResult(pair)) ?? []);
const commonDate = computed(() => {
  const cards = comparison.value?.cards ?? [];
  return cards.length >= 2 && cards.every(card => card.sourceAsOf && card.sourceAsOf === cards[0]?.sourceAsOf && card.holdingCount > 0) ? cards[0]?.sourceAsOf : null;
});
const globalDateAlignment = computed(() => comparison.value?.type === "global" ? comparison.value.dateAlignment : undefined);
const formatFetchedAt = (value?: string | null) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "未知";

function toggleCode(code: string): void {
  selectedCodes.value = selectedCodes.value.includes(code) ? selectedCodes.value.filter((value) => value !== code) : selectedCodes.value.length < 4 ? [...selectedCodes.value, code] : selectedCodes.value;
}
function changeType(type: "tw" | "global"): void {
  selectedType.value = type;
  selectedCodes.value = defaultCodes(type);
}
function hasResearchResult(result: NonNullable<typeof comparison.value>, codes: string[]): boolean {
  return result.cards.length === codes.length && result.cards.every(card => codes.includes(card.code) && card.holdingCount > 0 && card.sourceAsOf)
    && (result.type !== 'tw' || result.cards.every(card => card.sourceAsOf === result.cards[0]?.sourceAsOf));
}
function apply(): void {
  if (!canCompare.value) return;
  const request = comparisonRequests.begin(selectedType.value, selectedCodes.value, "comparison_builder");
  if (selectedType.value === props.type && selectedCodes.value.join(',') === props.codes.join(',')) {
    void load(selectedType.value, selectedCodes.value).then(async result => {
      if (result && hasResearchResult(result, selectedCodes.value)) { await nextTick(); comparisonRequests.complete(request); }
    });
  }
  emit("navigate", `/compare/etfs?type=${selectedType.value}&codes=${selectedCodes.value.join(',')}&metric=${metric.value}`);
  builderOpen.value = false;
}
function selectMetric(value: Metric): void {
  metric.value = value;
  const url = new URL(window.location.href);
  url.searchParams.set("metric", value);
  window.history.replaceState(window.history.state, "", url);
}
function unlockHoldings(): void {
  selectMetric("holdings");
  signUp("comparison_summary_unlock");
}

watch(() => [props.type, props.codes.join(","), props.refreshKey, isAuthenticated.value], async (current, previous) => {
  const codes = effectiveCodes(props.type, props.codes);
  selectedType.value = props.type;
  selectedCodes.value = codes;
  if (!hasPreset.value) builderOpen.value = true;
  if (codes.length >= 2 && codes.length <= 4) {
    const refreshed = previous && current[2] !== previous[2];
    const request = hasPreset.value ? (refreshed ? comparisonRequests.begin(props.type, codes, "refresh") : comparisonRequests.resume(props.type, codes)) : null;
    const result = await load(props.type, codes);
    if (result && hasResearchResult(result, codes) && hasPreset.value) {
      await nextTick();
      comparisonRequests.complete(request);
    }
  }
}, { immediate: true });
onBeforeUnmount(abort);
</script>

<template>
  <section class="compare-view">
    <header class="compare-hero" :class="{ 'preset-hero': hasPreset }"><span>ETF 多檔比較</span><h1>持股重疊、調倉與配置差異</h1><p>{{ hasPreset ? '依網址自動比較，不需再按一次比較。' : '選擇 2 至 4 檔同市場 ETF，查看持股差異。13F 不屬於 ETF。' }}</p></header>
    <p v-if="error" class="compare-error">{{ error }}</p><p v-else-if="loading && !comparison" class="compare-state">比較資料載入中…</p>
    <section v-if="hasPreset && comparison" class="comparison-summary" aria-label="核心比較摘要" data-testid="comparison-summary">
      <div class="summary-identities"><div v-for="card in comparison.cards" :key="card.code"><b>{{ card.code }}</b><span>{{ card.name }}</span></div></div>
      <p class="summary-date">{{ commonDate ? `共同持股資料日 ${commonDate}` : '資料不足或日期不同，無法呈現同日比較摘要。' }}</p>
      <div v-if="commonDate" class="summary-pairs"><article v-for="pair in visiblePairs" :key="`${pair.left}-${pair.right}`"><small v-if="comparison.cards.length > 2">{{ pair.left }} × {{ pair.right }}</small><div><span>共同持股</span><strong>{{ pair.intersectionCount }} <small>檔</small></strong></div><div><span>權重重疊</span><strong>{{ formatWeight(pair.weightedOverlap) }}</strong></div></article></div>
      <p v-if="!visiblePairs.length">此組重疊結果依會員權限遮隱；登入後可查看已取得的資料。</p>
      <p class="summary-confidence">涵蓋 {{ comparison.coverage.available }} / {{ comparison.coverage.tracked }} 檔 · {{ comparison.confidence.reason }} · 缺漏不代表零。</p>
      <a class="result-jump" href="#comparison-details">查看比較結果 ↓</a>
    </section>
    <details class="builder-disclosure" :open="builderOpen" @toggle="builderOpen = ($event.target as HTMLDetailsElement).open"><summary>{{ hasPreset ? '更換 ETF' : '選擇 ETF' }} <small>同市場，最多 4 檔</small></summary><section class="compare-builder"><div class="type-toggle"><button type="button" :class="{active:selectedType==='tw'}" @click="changeType('tw')">台灣主動 ETF</button><button type="button" :class="{active:selectedType==='global'}" @click="changeType('global')">海外 ETF</button></div><div class="code-options"><button v-for="option in options" :key="option.code" type="button" :class="{selected:selectedCodes.includes(option.code)}" :aria-pressed="selectedCodes.includes(option.code)" @click="toggleCode(option.code)"><b>{{ option.code }}</b><small>{{ option.name }}</small></button></div><footer><span>已選 {{ selectedCodes.length }} / 4 檔</span><button type="button" :disabled="!canCompare" @click="apply"><GitCompareArrows :size="17" />比較 ETF</button></footer></section></details>
    <section v-if="comparison && !isAuthenticated" class="comparison-unlock" aria-label="免費會員解鎖"><strong>免費註冊，解鎖會員限定比較持股</strong><p>解鎖本頁已遮隱的主要持股與共同持股。每檔顯示最多 8 筆主要持股；資料缺漏仍會標示。</p><button type="button" @click="unlockHoldings">免費註冊，解鎖會員限定比較持股</button><button type="button" class="existing-login" @click="signIn('comparison_summary_login')">已有 GoGoWinners 帳號？登入</button><small>ETF 持倉雷達使用 GoGoWinners 共用帳號登入。</small></section>
    <details v-if="comparison" class="coverage-details"><summary>資料涵蓋、可信度與計算方法</summary><IntelligenceMetaStrip :source-as-of="comparison.sourceAsOf" :generated-at="comparison.generatedAt" :coverage="comparison.coverage" :confidence="comparison.confidence" /><SourceDisclosure :note="`${comparison.methodology.setOverlap}；${comparison.methodology.weightedOverlap}。${comparison.methodology.missingWeight}。${comparison.methodology.exposureIdentity}`" /></details>
    <section v-if="comparison?.type === 'global'" class="date-alignment-notice" :class="{ mixed: !globalDateAlignment?.commonDate }" data-testid="global-date-alignment">
      <strong>{{ globalDateAlignment?.commonDate ? `共同資料日：${globalDateAlignment.commonDate}` : '非共同資料日' }}</strong>
      <p>{{ globalDateAlignment?.commonDate ? '各檔海外 ETF 使用相同持股資料日。' : '各檔海外 ETF 依發行商最新有效快照比較，持股資料日可能不同，請勿解讀為同日橫截面。' }}</p>
      <div><span v-for="row in globalDateAlignment?.rows ?? comparison.cards" :key="row.code"><b>{{ row.code }}</b> 持股資料日 {{ row.sourceAsOf ?? '未知' }}｜最後抓取 {{ formatFetchedAt(row.fetchedAt) }}</span></div>
    </section>

    <nav v-if="comparison" id="comparison-details" class="metric-selector" aria-label="比較指標"><button v-for="item in [{id:'overview',label:'摘要'},{id:'holdings',label:'持股'},{id:'sectors',label:'產業'},{id:'activity',label:'調整'}]" :key="item.id" type="button" :class="{active:metric===item.id}" @click="selectMetric(item.id as Metric)">{{ item.label }}</button></nav>

    <section v-if="comparison" class="etf-card-grid">
      <article v-for="card in comparison.cards" :key="card.code" class="etf-card">
        <header><span>{{ comparison.type === 'tw' ? '台灣 ETF' : '海外 ETF' }}</span><h2>{{ card.code }} {{ card.name }}</h2><small>{{ card.issuer }}｜持股資料日 {{ card.sourceAsOf ?? '-' }}</small><small v-if="comparison.type === 'global'">最後抓取 {{ formatFetchedAt(card.fetchedAt) }}</small></header>
        <div v-if="metric==='overview'" class="card-metrics"><span>基金規模 <b>{{ formatMoney(card.fundSize) }}</b></span><span>持股數 <b>{{ card.holdingCount > 0 ? card.holdingCount : '尚無有效資料' }}</b></span><span>前十大集中度 <b>{{ formatWeight(card.top10Concentration) }}</b></span><span>HHI <b>{{ formatNumber(card.hhi,4) }}</b></span><span v-if="comparison.type==='tw'">折溢價 <b :class="valueTone(card.premiumDiscount)">{{ formatSignedPp(card.premiumDiscount) }}</b></span></div>
        <div v-else-if="metric==='holdings'" class="rank-list"><template v-for="(holding,index) in card.topHoldings.slice(0,8)" :key="isMemberLockedResult(holding) ? `holding-locked-${index}` : holding.key"><MemberLockedResult v-if="shouldRenderMemberLock(card.topHoldings,holding,isAuthenticated,index)" compact title="比較持股已遮隱" :source="`compare_holding_${index + 1}`" /><span v-else><b>{{ holding.symbol }} {{ holding.name }}</b><small>{{ holding.assetType }}｜{{ formatWeight(holding.weight) }}</small></span></template></div>
        <div v-else-if="metric==='sectors'" class="rank-list"><template v-for="(sector,index) in card.sectorExposure.slice(0,8)" :key="isMemberLockedResult(sector) ? `sector-locked-${index}` : sector.sector"><MemberLockedResult v-if="shouldRenderMemberLock(card.sectorExposure,sector,isAuthenticated,index)" compact title="比較產業已遮隱" :source="`compare_sector_${index + 1}`" /><span v-else><b>{{ sector.sector }}</b><small>{{ formatWeight(sector.weight) }}</small></span></template><template v-if="card.assetComposition"><template v-for="(asset,index) in card.assetComposition" :key="isMemberLockedResult(asset) ? `asset-locked-${index}` : asset.assetType"><MemberLockedResult v-if="shouldRenderMemberLock(card.assetComposition,asset,isAuthenticated,index)" compact title="資產組成已遮隱" :source="`compare_asset_${index + 1}`" /><span v-else><b>{{ asset.assetType }}</b><small>{{ formatWeight(asset.weight) }}</small></span></template></template></div>
        <div v-else class="rank-list"><template v-if="card.activeAdjustments"><template v-for="(item,index) in card.activeAdjustments" :key="isMemberLockedResult(item) ? `activity-locked-${index}` : item.window"><MemberLockedResult v-if="shouldRenderMemberLock(card.activeAdjustments,item,isAuthenticated,index)" compact title="調整資料已遮隱" :source="`compare_activity_${index + 1}`" /><span v-else><b :class="valueTone(item.cumulativeActiveNetLots)">{{ item.window }} 日主動 {{ formatNumber(item.cumulativeActiveNetLots) }} 張</b><small>調整強度 {{ formatNumber(item.adjustmentIntensity,2) }}｜加碼持股筆數 {{ item.increaseHoldingChangeCount }}｜減碼持股筆數 {{ item.decreaseHoldingChangeCount }}</small></span></template><MemberLockedResult v-if="!isAuthenticated || isMemberLockedResult(card.addedHoldings) || isMemberLockedResult(card.exitedHoldings)" compact title="當期調整廣度已遮隱" source="compare_breadth" /><span v-else><b>新增 {{ card.addedHoldings }}／退出 {{ card.exitedHoldings }}</b><small>當期調整廣度</small></span></template><template v-else><MemberLockedResult v-if="!isAuthenticated || isMemberLockedResult(card.weightAdjustmentIntensity)" compact title="權重調整強度已遮隱" source="compare_intensity" /><span v-else><b>權重調整強度 {{ formatNumber(card.weightAdjustmentIntensity,2) }}</b><small>Σ |weight change| / 2</small></span></template></div>
      </article>
    </section>

    <section v-if="comparison" class="pairwise-panel"><div class="section-title"><Layers3 :size="20" /><div><h2>Pairwise 重疊矩陣</h2><p>手機使用比較卡，不需要橫向捲動四檔寬表格。</p></div></div><div class="pair-grid"><template v-for="(pair,index) in comparison.pairwise" :key="isMemberLockedResult(pair) ? `pair-locked-${index}` : `${pair.left}-${pair.right}`"><MemberLockedResult v-if="shouldRenderMemberLock(comparison.pairwise,pair,isAuthenticated,index)" title="重疊比較已遮隱" :source="`compare_pair_${index + 1}`" /><article v-else><header><b>{{ pair.left }} × {{ pair.right }}</b><span>共同 {{ pair.intersectionCount }} / 聯集 {{ pair.unionCount }}</span></header><div><span>Jaccard</span><strong>{{ pair.similarity === null ? '-' : formatNumber(pair.similarity * 100,1) + '%' }}</strong></div><div><span>權重重疊</span><strong>{{ formatWeight(pair.weightedOverlap) }}</strong></div><details><summary>共同持股 {{ pair.common.length }} 檔</summary><template v-for="(holding,holdingIndex) in pair.common" :key="isMemberLockedResult(holding) ? `common-locked-${holdingIndex}` : holding.key"><MemberLockedResult v-if="shouldRenderMemberLock(pair.common,holding,isAuthenticated,holdingIndex)" compact title="共同持股已遮隱" :source="`compare_common_${holdingIndex + 1}`" /><p v-else><b>{{ holding.label }}</b><span>{{ pair.left }} {{ formatWeight(holding.leftWeight) }}｜{{ pair.right }} {{ formatWeight(holding.rightWeight) }}</span></p></template></details></article></template></div></section>
    <SourceDisclosure v-if="comparison" :note="`${comparison.methodology.setOverlap}；${comparison.methodology.weightedOverlap}。${comparison.methodology.missingWeight}。${comparison.methodology.exposureIdentity}`" />
  </section>
</template>

<style scoped>
.preset-hero{padding:18px 22px}.preset-hero h1{font-size:27px}.comparison-summary{padding:18px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.summary-identities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.summary-identities>div{display:grid;gap:4px}.summary-identities b{font-size:21px;color:var(--theme-text-strong)}.summary-identities span{font-size:13px;color:var(--theme-text-muted)}.summary-date{margin:12px 0;color:var(--theme-text);font-size:13px}.summary-pairs{display:grid;gap:8px}.summary-pairs article{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;border-radius:9px;background:var(--theme-surface-muted)}.summary-pairs article>small{grid-column:1/-1}.summary-pairs article>div{display:grid;gap:5px}.summary-pairs span{font-size:12px;color:var(--theme-text-muted)}.summary-pairs strong{font-size:27px;color:var(--theme-text-strong)}.summary-pairs strong small{font-size:14px}.summary-confidence{font-size:12px;line-height:1.5;color:var(--theme-text-muted)}.result-jump{display:inline-flex;align-items:center;min-height:44px;font-weight:800;color:#087b72}.builder-disclosure,.coverage-details{border:1px solid var(--theme-border);border-radius:11px;background:var(--theme-surface)}.builder-disclosure>summary,.coverage-details>summary{min-height:44px;padding:12px 16px;cursor:pointer;color:var(--theme-text-strong);font-weight:750}.builder-disclosure>summary small{color:var(--theme-text-muted);font-weight:400;margin-left:8px}.builder-disclosure .compare-builder{border:0}.coverage-details[open]{display:grid;gap:12px;padding-bottom:14px}.comparison-unlock{display:grid;gap:9px;padding:16px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface-muted)}.comparison-unlock strong{color:var(--theme-text-strong)}.comparison-unlock p{margin:0;color:var(--theme-text-muted);font-size:13px;line-height:1.6}.comparison-unlock button{min-height:44px;border:0;border-radius:9px;background:#087b72;color:#fff;font-weight:800;cursor:pointer;padding:9px}.comparison-unlock .existing-login{background:transparent;color:var(--theme-text);text-decoration:underline}.comparison-unlock small{font-size:12px;color:var(--theme-text-muted)}#comparison-details{scroll-margin-top:100px}.compare-view{padding-bottom:20px}
@media(max-width:650px){.compare-hero.preset-hero{padding:15px 16px}.preset-hero h1{font-size:23px}.comparison-summary{padding:14px}.summary-identities span{font-size:12px}.summary-pairs strong{font-size:25px}}
.compare-view{display:grid;gap:16px}.compare-hero{padding:28px;border-radius:15px;background:linear-gradient(135deg,#102f46,#0c6b65);color:#fff}.compare-hero>span{color:#69e2d5;font-size:12px;font-weight:850;letter-spacing:.13em}.compare-hero h1{margin:8px 0;font-size:34px}.compare-hero p{max-width:850px;margin:0;color:#d8ecec;line-height:1.7}.compare-builder,.pairwise-panel{display:grid;gap:14px;padding:20px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.type-toggle{display:flex;gap:6px}.type-toggle button,.metric-selector button{min-height:42px;padding:0 14px;border:1px solid var(--theme-border);border-radius:9px;background:var(--theme-surface);color:var(--theme-text-muted);font-weight:760}.type-toggle button.active,.metric-selector button.active{border-color:#173f56;background:#173f56;color:#fff}.code-options{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(68px,auto);gap:7px;max-height:293px;overflow:auto;scrollbar-gutter:stable}.code-options button{display:grid;align-content:center;gap:3px;min-height:68px;padding:8px 10px;overflow:hidden;border:1px solid var(--theme-border);border-radius:9px;background:var(--theme-surface-muted);color:var(--theme-text);text-align:left}.code-options button b{line-height:1.35}.code-options button.selected{border-color:#087b72;background:#edf8f6;color:#0c4d49}.code-options button.selected small{color:#315f5b}.code-options small{overflow:visible;color:var(--theme-text-muted);line-height:1.5;overflow-wrap:anywhere;white-space:normal}.compare-builder footer{display:flex;justify-content:space-between;align-items:center;color:var(--theme-text-muted)}.compare-builder footer button{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 15px;border:0;border-radius:9px;background:#0b766f;color:#fff;font-weight:780}.compare-builder footer button:disabled{opacity:.45}.metric-selector{display:flex;gap:6px;overflow:auto}.etf-card-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.etf-card{display:grid;gap:14px;padding:18px;border:1px solid var(--theme-border);border-radius:13px;background:var(--theme-surface)}.etf-card header{display:grid;gap:4px}.etf-card header>span{color:#087b72;font-size:11px;font-weight:800}.etf-card h2{margin:0;color:var(--theme-text-strong);font-size:19px}.etf-card small{color:var(--theme-text-muted)}.card-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.card-metrics span,.rank-list>span{display:grid;gap:4px;padding:9px;border-radius:8px;background:var(--theme-surface-muted);color:var(--theme-text-muted);font-size:12px}.card-metrics b,.rank-list b{color:var(--theme-text-strong);font-size:14px}.rank-list{display:grid;gap:5px}.section-title{display:flex;gap:9px}.section-title h2{margin:0 0 4px;color:var(--theme-text-strong)}.section-title p{margin:0;color:var(--theme-text-muted)}.pair-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.pair-grid>article{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:15px;border:1px solid var(--theme-border);border-radius:11px}.pair-grid header,.pair-grid details{grid-column:1 / -1}.pair-grid header{display:flex;justify-content:space-between;gap:8px}.pair-grid header span,.pair-grid div span,.pair-grid details span{color:var(--theme-text-muted);font-size:12px}.pair-grid div{display:grid;gap:3px}.pair-grid strong{font-size:20px}.pair-grid summary{min-height:38px;padding-top:10px;border-top:1px solid var(--theme-border);cursor:pointer;color:#345986;font-weight:760}.pair-grid details p{display:flex;justify-content:space-between;gap:10px;margin:0;padding:7px 0;border-bottom:1px solid var(--theme-border);font-size:12px}.compare-error{padding:13px;border:1px solid #f1c4c0;border-radius:10px;background:#fff4f3;color:#a8322a}.compare-state{color:var(--theme-text-muted)}
.date-alignment-notice{display:grid;gap:8px;padding:16px;border:1px solid var(--theme-border);border-left:4px solid #087b72;border-radius:11px;background:var(--theme-surface);color:var(--theme-text)}.date-alignment-notice.mixed{border-left-color:#b26a00;background:var(--theme-surface-muted)}.date-alignment-notice strong{color:var(--theme-text-strong);font-size:17px}.date-alignment-notice p{margin:0;color:var(--theme-text-muted);line-height:1.5}.date-alignment-notice div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.date-alignment-notice span{padding:8px;border-radius:7px;background:var(--theme-surface);color:var(--theme-text-muted);font-size:12px}
@media(max-width:850px){.code-options{grid-template-columns:repeat(2,1fr)}.pair-grid{grid-template-columns:1fr}}
@media(max-width:650px){.compare-hero{padding:23px 18px}.compare-hero h1{font-size:28px}.compare-builder{padding:15px 12px}.date-alignment-notice div{grid-template-columns:1fr}.etf-card-grid{grid-template-columns:1fr}.card-metrics{grid-template-columns:1fr 1fr}.pairwise-panel{padding:16px 12px}.pair-grid>article{grid-template-columns:1fr}.pair-grid header,.pair-grid details{grid-column:auto}.pair-grid header{display:grid}.pair-grid details p{display:grid}}
.compare-hero.preset-hero{padding:18px 22px}.compare-hero.preset-hero h1{font-size:27px}
@media(max-width:650px){.compare-hero.preset-hero{padding:15px 16px}.compare-hero.preset-hero h1{font-size:23px}.compare-view{gap:12px}.comparison-summary{padding:12px}.comparison-unlock{padding:12px;gap:7px}}
</style>
