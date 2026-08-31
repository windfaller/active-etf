<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Building2, Globe2 } from "@lucide/vue";
import MemberLockedResult from "../components/MemberLockedResult.vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import { useAuth } from "../composables/useAuth";
import type { GlobalHolding, GlobalReport } from "../contracts/global";
import { shouldMaskMemberResult } from "../domain/memberVisibility";
import { formatSignedPp, formatWeight, valueTone } from "../utils/format";

const props = defineProps<{ report: GlobalReport | null; loading: boolean; error: string; selectedDate: string }>();
const emit = defineEmits<{ etf: [code: string]; institutions: [] }>();
const { isAuthenticated } = useAuth();
const sections = computed(() => (props.report?.sections ?? []).filter((row) => row.strategyType !== "13f"));
function keyOf(row: GlobalHolding): string { return row.ticker ?? row.name; }
const commonRows = computed(() => {
  const rows = new Map<string,{ticker?:string;name:string;etfs:Array<{code:string;weight:number}>;total:number;max:number}>();
  for (const section of sections.value) for (const holding of section.topHoldings) {
    const key = keyOf(holding); const weight = holding.weightPercent ?? 0; const current = rows.get(key) ?? { ticker: holding.ticker, name: holding.name, etfs: [], total: 0, max: 0 };
    current.etfs.push({ code: section.etfCode, weight }); current.total += weight; current.max = Math.max(current.max, weight); rows.set(key,current);
  }
  return [...rows.values()].filter((row) => row.etfs.length >= 2).sort((a,b) => b.etfs.length-a.etfs.length || b.total-a.total).slice(0,30);
});
const moverRows = computed(() => {
  const rows = new Map<string,{ticker?:string;name:string;etfs:string[];delta:number}>();
  for (const section of sections.value) for (const change of section.weightChanges) {
    const key = change.positionKey ?? change.ticker ?? change.name; const current = rows.get(key) ?? { ticker: change.ticker, name: change.name, etfs: [], delta: 0 };
    current.etfs.push(section.etfCode); current.delta += change.deltaPp ?? 0; rows.set(key,current);
  }
  return [...rows.values()].filter((row) => row.etfs.length >= 2).sort((a,b) => b.etfs.length-a.etfs.length || Math.abs(b.delta)-Math.abs(a.delta)).slice(0,24);
});
</script>

<template>
  <section class="global-market-view view-shell">
    <header class="global-hero"><div><span class="eyebrow">海外 ETF</span><h1>海外 ETF 市場總覽</h1><p>專注發行商官方持股與持股權重變化。機構 13F 因時間尺度不同，改在獨立頁面呈現。</p></div><Globe2 :size="90" aria-hidden="true" /></header>
    <a class="institution-entry" href="/institutions" @click.prevent="emit('institutions')"><Building2 :size="24" /><span><b>前往機構 13F</b><small>季度持倉、持倉截止日與延遲天數</small></span><ArrowRight :size="19" /></a>
    <p v-if="error" class="error-message">{{ error }}</p>
    <section class="data-panel"><div class="panel-heading"><div><h2>海外 ETF 共同持有</h2><p>{{ selectedDate || report?.reportDate || "-" }}｜只比較 ETF，不混入 13F。</p></div></div>
      <ResponsiveDataTable label="海外 ETF 共同持有" :empty="!loading && !commonRows.length">
        <div class="global-table"><div class="table-head"><span>標的</span><span>持有 ETF</span><span>合計權重</span><span>最高權重</span></div><template v-for="(row,index) in commonRows" :key="row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="共同持有資料已遮隱" :source="`global_common_${index + 1}`" /><div v-else class="table-row"><span class="stock"><b>{{ row.ticker ?? "-" }}</b><small>{{ row.name }}</small></span><span class="chips"><a v-for="etf in row.etfs" :key="etf.code" :href="`/global-etfs/${etf.code}`" @click.prevent="emit('etf',etf.code)">{{ etf.code }}</a></span><span>{{ formatWeight(row.total,1) }}</span><span>{{ formatWeight(row.max,1) }}</span></div></template></div>
        <template #mobile><template v-for="(row,index) in commonRows" :key="row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="共同持有資料已遮隱" :source="`global_common_mobile_${index + 1}`" /><MobileDataCard v-else :label="row.ticker ?? row.name"><template #title>{{ row.ticker ?? "-" }} {{ row.name }}</template><template #summary>{{ row.etfs.length }} 檔 ETF 共同持有｜合計 {{ formatWeight(row.total,1) }}</template><p>最高單檔權重 {{ formatWeight(row.max,1) }}</p><p><a v-for="etf in row.etfs" :key="etf.code" :href="`/global-etfs/${etf.code}`" class="chip" @click.prevent="emit('etf',etf.code)">{{ etf.code }} {{ formatWeight(etf.weight,1) }}</a></p></MobileDataCard></template></template>
      </ResponsiveDataTable>
    </section>
    <section class="data-panel"><div class="panel-heading"><div><h2>海外 ETF 共同權重變化</h2><p>使用 ETF 持股權重變化，不將被動 ETF 寫成經理人主動加碼。</p></div></div>
      <ResponsiveDataTable label="海外 ETF 共同權重變化" :empty="!loading && !moverRows.length">
        <div class="global-table"><div class="table-head"><span>標的</span><span>影響 ETF</span><span>方向</span><span>合計變化</span></div><template v-for="(row,index) in moverRows" :key="row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="共同權重變化已遮隱" :source="`global_mover_${index + 1}`" /><div v-else class="table-row"><span class="stock"><b>{{ row.ticker ?? "-" }}</b><small>{{ row.name }}</small></span><span class="chips"><a v-for="code in row.etfs" :key="code" :href="`/global-etfs/${code}`" @click.prevent="emit('etf',code)">{{ code }}</a></span><span :class="valueTone(row.delta)">{{ row.delta > 0 ? '增加 ▲' : row.delta < 0 ? '減少 ▼' : '持平' }}</span><span :class="valueTone(row.delta)">{{ formatSignedPp(row.delta,1) }}</span></div></template></div>
        <template #mobile><template v-for="(row,index) in moverRows" :key="row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="共同權重變化已遮隱" :source="`global_mover_mobile_${index + 1}`" /><MobileDataCard v-else :label="row.ticker ?? row.name" :tone="row.delta > 0 ? 'increase' : row.delta < 0 ? 'decrease' : 'neutral'"><template #title>{{ row.ticker ?? "-" }} {{ row.name }}</template><template #summary><span :class="valueTone(row.delta)">{{ row.delta > 0 ? '權重增加 ▲' : row.delta < 0 ? '權重減少 ▼' : '權重持平' }} {{ formatSignedPp(row.delta,1) }}</span>｜{{ row.etfs.length }} 檔 ETF</template><p><a v-for="code in row.etfs" :key="code" :href="`/global-etfs/${code}`" class="chip" @click.prevent="emit('etf',code)">{{ code }}</a></p></MobileDataCard></template></template>
      </ResponsiveDataTable>
    </section>
    <SourceDisclosure note="海外 ETF 資料來自各發行商官方公開持股；不同 ETF 公告日期可能不一致。" />
  </section>
</template>

<style scoped>
.view-shell{display:grid;gap:16px}.global-hero{display:flex;justify-content:space-between;align-items:center;gap:30px;min-height:230px;padding:34px;border-radius:15px;background:linear-gradient(130deg,#08263d,#0d5360);color:#fff}.global-hero>div{max-width:780px}.eyebrow{color:#47dac8;font-size:12px;font-weight:850;letter-spacing:.14em}.global-hero h1{margin:10px 0;font-size:38px}.global-hero p{margin:0;color:#d4e7e9;font-size:16px;line-height:1.7}.global-hero>svg{color:#3bcdbd;opacity:.58}.institution-entry{display:grid;grid-template-columns:30px 1fr 24px;align-items:center;gap:12px;width:100%;min-height:78px;padding:15px 20px;border:1px solid #dce4e8;border-radius:12px;background:#fff;color:#35434e;text-align:left;cursor:pointer}.institution-entry span{display:grid;gap:4px}.institution-entry small{color:#71808a}.institution-entry:hover{border-color:#8ba3b6}.data-panel{padding:23px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.panel-heading{margin-bottom:16px}.panel-heading h2{margin:0 0 6px;color:#26343f}.panel-heading p{margin:0;color:#71808a}.global-table{overflow:hidden;border:1px solid #e1e7ea;border-radius:10px}.table-head,.table-row{display:grid;grid-template-columns:1.35fr 1.5fr .8fr .8fr;gap:12px;align-items:center}.table-head{padding:11px 14px;background:#f2f6f7;color:#66737e;font-size:12px;font-weight:780}.table-row{min-height:64px;padding:10px 14px;border-top:1px solid #edf1f3;color:#394752}.stock{display:grid;gap:3px}.stock small{color:#7b8791}.chips{display:flex;flex-wrap:wrap;gap:5px}.chips button,.chip{min-height:32px;padding:5px 8px;border:1px solid #cad7dd;border-radius:7px;background:#f7fafb;color:#345986;font-weight:780;cursor:pointer}.positive{color:var(--theme-positive);font-weight:780}.negative{color:var(--theme-negative);font-weight:780}.neutral{color:var(--theme-neutral);font-weight:780}.error-message{margin:0;padding:13px;border:1px solid #f3c7c3;border-radius:10px;background:#fff4f3;color:#a8322a}
@media(max-width:760px){.global-hero{padding:25px 18px}.global-hero h1{font-size:32px}.global-hero>svg{display:none}.data-panel{padding:16px 12px}}
.institution-entry{text-decoration:none}.chips a,.chip{display:inline-flex;align-items:center;min-height:32px;padding:5px 8px;border:1px solid #cad7dd;border-radius:7px;background:#f7fafb;color:#345986;font-weight:780;text-decoration:none}
</style>
