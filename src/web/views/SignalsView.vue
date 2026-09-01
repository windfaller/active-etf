<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ArrowRightLeft, Repeat2, Split } from "@lucide/vue";
import IntelligenceMetaStrip from "../components/IntelligenceMetaStrip.vue";
import MemberLockedResult from "../components/MemberLockedResult.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import { useAuth } from "../composables/useAuth";
import { useSignals } from "../composables/useSignals";
import type { SignalsResponse } from "../contracts/signals";
import { isMemberLockedResult, shouldRenderMemberLock } from "../domain/memberVisibility";
import { directionTone, formatLots, formatNumber, formatSharesAsLots, valueTone } from "../utils/format";

const props = defineProps<{ kind: SignalsResponse["kind"]; refreshKey?: number }>();
const emit = defineEmits<{ navigate: [path: string] }>();
const { isAuthenticated } = useAuth();
const windowSize = ref<3 | 5 | 20>(20);
const { signals, loading, error, load, abort } = useSignals();
const tabs = [
  { kind: "all", label: "全部訊號", path: "/signals" },
  { kind: "consecutive", label: "連續調倉", path: "/signals/consecutive" },
  { kind: "reversals", label: "方向反轉", path: "/signals/reversals" },
  { kind: "divergence", label: "ETF × 法人", path: "/signals/divergence" }
] as const;
const showConsecutive = computed(() => props.kind === "all" || props.kind === "consecutive");
const showReversals = computed(() => props.kind === "all" || props.kind === "reversals");
const showDivergence = computed(() => props.kind === "all" || props.kind === "divergence");
const directionLabel = (direction: string) => direction === "increase" ? "加碼" : direction === "decrease" ? "減碼" : "無方向";
const confidenceLabel = (level: string) => ({ high: "高", medium: "中", low: "低" })[level] ?? level;

watch(() => [props.kind, props.refreshKey, windowSize.value], () => void load(props.kind, windowSize.value), { immediate: true });
onBeforeUnmount(abort);
</script>

<template>
  <section class="signals-view">
    <header class="signals-hero"><span>交易日訊號</span><h1>連續調倉、反轉與方向分歧</h1><p>訊號只使用有效市場交易日；neutral 是實際觀察但未跨門檻，unknown 是缺少觀察，兩者都會中斷連續訊號。研究解讀不代表買賣建議或未來報酬預測。</p></header>
    <nav class="signal-tabs" aria-label="訊號頁籤"><a v-for="tab in tabs" :key="tab.kind" :href="tab.path" :class="{active:kind===tab.kind}" @click.prevent="emit('navigate',tab.path)">{{ tab.label }}</a><label>觀察期<select v-model.number="windowSize"><option :value="3">3 日</option><option :value="5">5 日</option><option :value="20">20 日</option></select></label></nav>
    <p v-if="error" class="signal-error">{{ error }}</p><p v-else-if="loading && !signals" class="signal-state">訊號載入中…</p>
    <IntelligenceMetaStrip v-if="signals" :source-as-of="signals.sourceAsOf" :generated-at="signals.generatedAt" :coverage="signals.coverage" :confidence="signals.confidence" />

    <section v-if="signals && showConsecutive" class="signal-section"><div class="section-title"><Repeat2 :size="21" /><div><h2>連續加碼／減碼</h2><p>至少連續 2 個有效觀察日，最新日仍需跨過 neutral 門檻。</p></div></div><div v-if="signals.consecutive.length" class="signal-grid"><template v-for="(row,index) in signals.consecutive" :key="isMemberLockedResult(row) ? `consecutive-locked-${index}` : row.stock.symbol"><MemberLockedResult v-if="shouldRenderMemberLock(signals.consecutive,row,isAuthenticated,index)" compact title="連續訊號已遮隱" :source="`signal_consecutive_${index + 1}`" /><a v-else :href="row.stock.path" :data-testid="`signal-consecutive-${row.stock.symbol}`" @click.prevent="emit('navigate',row.stock.path)"><header><span :class="[row.direction, directionTone(row.direction)]">{{ directionLabel(row.direction) }}</span><b>{{ row.stock.symbol }} {{ row.stock.name }}</b></header><strong>連續 {{ row.consecutiveTradingDays }} 日</strong><p class="signal-metric" :class="valueTone(row.cumulativeActiveNetLots)">累積主動 {{ formatLots(row.cumulativeActiveNetLots) }} 張</p><footer><span>{{ row.participatingEtfs }} 檔參與｜同向 {{ row.sameDirectionEtfRatio === null ? '-' : formatNumber(row.sameDirectionEtfRatio*100,0)+'%' }}</span><small>有效觀察 {{ row.actualObservationCount }}/{{ row.actualObservationCount + row.missingObservationCount }}｜信心 {{ confidenceLabel(row.confidence.level) }}</small><small>{{ row.startDate }} → {{ row.latestDate }}</small></footer></a></template></div><p v-else class="signal-state">此觀察期沒有達到條件的連續訊號。</p></section>

    <section v-if="signals && showReversals" class="signal-section"><div class="section-title"><ArrowRightLeft :size="21" /><div><h2>反轉訊號</h2><p>反轉前至少 2 個有效交易日同方向，不以單日正負號變化判定。</p></div></div><div v-if="signals.reversals.length" class="signal-grid"><template v-for="(row,index) in signals.reversals" :key="isMemberLockedResult(row) ? `reversal-locked-${index}` : row.stock.symbol"><MemberLockedResult v-if="shouldRenderMemberLock(signals.reversals,row,isAuthenticated,index)" compact title="反轉訊號已遮隱" :source="`signal_reversal_${index + 1}`" /><a v-else :href="row.stock.path" :data-testid="`signal-reversal-${row.stock.symbol}`" @click.prevent="emit('navigate',row.stock.path)"><header><span class="reversal">反轉</span><b>{{ row.stock.symbol }} {{ row.stock.name }}</b></header><strong>{{ row.reversalType }}</strong><p class="reversal-values"><span :class="valueTone(row.beforeActiveNetLots)">反轉前 {{ formatLots(row.beforeActiveNetLots) }} 張</span><b>→</b><span :class="valueTone(row.afterActiveNetLots)">當日 {{ formatLots(row.afterActiveNetLots) }} 張</span></p><footer><span>前段連續 {{ row.priorTradingDays }} 日｜{{ row.majorityEtfDirectionFlip ? '多數 ETF 同步翻轉' : '未形成多數翻轉' }}</span><small>{{ row.reversalDate }}｜信心 {{ confidenceLabel(row.confidence.level) }}</small></footer></a></template></div><p v-else class="signal-state">此觀察期沒有達到條件的反轉訊號。</p></section>

    <section v-if="signals && showDivergence" class="signal-section"><div class="section-title"><Split :size="21" /><div><h2>ETF 與法人分歧</h2><p>ETF 加碼遇法人賣超，或 ETF 減碼遇法人買超；缺任一側資料即為資料不足。</p></div></div><div v-if="signals.divergences.length" class="signal-grid"><template v-for="(row,index) in signals.divergences" :key="isMemberLockedResult(row) ? `divergence-locked-${index}` : row.stock.symbol"><MemberLockedResult v-if="shouldRenderMemberLock(signals.divergences,row,isAuthenticated,index)" compact title="分歧訊號已遮隱" :source="`signal_divergence_${index + 1}`" /><a v-else :href="row.stock.path" :data-testid="`signal-divergence-${row.stock.symbol}`" @click.prevent="emit('navigate',row.stock.path)"><header><span class="divergent">分歧</span><b>{{ row.stock.symbol }} {{ row.stock.name }}</b></header><strong class="divergence-directions"><span :class="directionTone(row.etfDirection)">ETF {{ directionLabel(row.etfDirection) }}</span><b>×</b><span :class="valueTone(row.institutionNetShares)">法人 {{ (row.institutionNetShares ?? 0) > 0 ? '買超' : (row.institutionNetShares ?? 0) < 0 ? '賣超' : '持平' }}</span></strong><p class="signal-metric" :class="valueTone(row.institutionNetShares)">法人合計 {{ formatSharesAsLots(row.institutionNetShares) }} 張</p><footer><span>{{ row.changedFromAligned ? '由一致轉為分歧' : '當日方向分歧' }}</span><small>{{ row.date }}｜信心 {{ confidenceLabel(row.confidence.level) }}</small></footer></a></template></div><p v-else class="signal-state">此觀察期沒有可確認的 ETF／法人分歧。</p></section>
    <SourceDisclosure v-if="signals" :note="`${signals.methodology.tradingDays} ${signals.methodology.neutralThreshold} ${signals.methodology.consensus}`" />
  </section>
</template>

<style scoped>
.signals-view{display:grid;gap:16px}.signals-hero{padding:28px;border-radius:15px;background:linear-gradient(135deg,#202e49,#0b6b65);color:#fff}.signals-hero>span{color:#6ce1d5;font-size:12px;font-weight:850;letter-spacing:.13em}.signals-hero h1{margin:8px 0;font-size:34px}.signals-hero p{max-width:870px;margin:0;color:#dbe9ed;line-height:1.7}.signal-tabs{display:flex;gap:6px;padding:6px;border:1px solid var(--theme-border);border-radius:11px;background:var(--theme-surface);overflow:auto}.signal-tabs button{flex:0 0 auto;min-height:42px;padding:0 14px;border:0;border-radius:8px;background:transparent;color:var(--theme-text-muted);font-weight:760}.signal-tabs button.active{background:#173f56;color:#fff}.signal-tabs label{display:flex;align-items:center;gap:7px;margin-left:auto;padding-left:12px;color:var(--theme-text-muted);font-size:12px}.signal-tabs select{height:38px;border:1px solid var(--theme-border);border-radius:8px;background:var(--theme-surface-muted);color:var(--theme-text)}.signal-section{display:grid;gap:14px;padding:21px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.section-title{display:flex;gap:9px}.section-title h2{margin:0 0 4px;color:var(--theme-text-strong)}.section-title p,.signal-state{margin:0;color:var(--theme-text-muted)}.signal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.signal-grid>button{display:grid;gap:8px;padding:15px;border:1px solid var(--theme-border);border-radius:11px;background:var(--theme-surface-muted);color:var(--theme-text);text-align:left;cursor:pointer}.signal-grid header{display:flex;align-items:center;gap:8px}.signal-grid header>span{padding:3px 7px;border:1px solid transparent;border-radius:999px;font-size:11px;font-weight:800}.signal-grid .increase{border-color:var(--theme-positive-border);background:var(--theme-positive-soft);color:var(--theme-positive)}.signal-grid .decrease{border-color:var(--theme-negative-border);background:var(--theme-negative-soft);color:var(--theme-negative)}.signal-grid .reversal{background:#f5edff;color:#7440a6}.signal-grid .divergent{background:#fff4db;color:#8d6200}.signal-grid strong{color:var(--theme-text-strong);font-size:17px}.signal-grid p{margin:0;color:var(--theme-text)}.signal-metric{font-weight:800}.reversal-values,.divergence-directions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.reversal-values span,.divergence-directions span{font-weight:800}.reversal-values b,.divergence-directions b{color:var(--theme-text-muted)}.signal-grid footer{display:grid;gap:3px;padding-top:8px;border-top:1px solid var(--theme-border);color:var(--theme-text-muted);font-size:12px}.signal-grid small{line-height:1.4}.signal-error{padding:13px;border:1px solid #f1c4c0;border-radius:10px;background:#fff4f3;color:#a8322a}
@media(max-width:900px){.signal-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.signals-hero{padding:23px 18px}.signals-hero h1{font-size:28px}.signal-tabs label{margin-left:0}.signal-section{padding:16px 12px}.signal-grid{grid-template-columns:1fr}}
.signal-tabs a{display:flex;align-items:center;flex:0 0 auto;min-height:42px;padding:0 14px;border-radius:8px;color:var(--theme-text-muted);font-weight:760;text-decoration:none}.signal-tabs a.active{background:#173f56;color:#fff}.signal-grid>a{display:grid;gap:8px;padding:15px;border:1px solid var(--theme-border);border-radius:11px;background:var(--theme-surface-muted);color:var(--theme-text);text-align:left;text-decoration:none;cursor:pointer}
</style>
