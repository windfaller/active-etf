<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle, ArrowRight, Building2 } from "@lucide/vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import type { GlobalEtfOption, GlobalReport } from "../contracts/global";
import { delayDays, formatMoney, formatSignedPp, formatWeight } from "../utils/format";

const props = defineProps<{ report: GlobalReport | null; options: GlobalEtfOption[]; selectedCode?: string; loading: boolean; error: string }>();
const emit = defineEmits<{ select: [code: string] }>();
const institutions = computed(() => props.options.filter((row) => row.strategyType === "13f"));
const section = computed(() => props.selectedCode ? props.report?.sections.find((row) => row.etfCode === props.selectedCode && row.strategyType === "13f") ?? null : null);
const lagDays = computed(() => delayDays(section.value?.sourceAsOf, props.report?.reportDate));
</script>

<template>
  <section class="institution-view view-shell">
    <header class="institution-hero"><Building2 :size="42" /><div><span class="eyebrow">機構 13F</span><h1>{{ section?.fundName ?? "機構 13F 季度持倉" }}</h1><p>13F 是季度申報資料，不是即時持倉，也不與 ETF 當日變化寫成「同步加碼」。</p></div></header>
    <aside class="filing-warning"><AlertTriangle :size="20" /><span><b>13F 並非即時持倉</b><small>機構可在季底後數週才申報，目前部位可能已變化。</small></span></aside>
    <p v-if="error" class="error-message">{{ error }}</p>
    <section v-if="!selectedCode" class="institution-grid">
      <button v-for="institution in institutions" :key="institution.etfCode" type="button" @click="emit('select',institution.etfCode)"><Building2 :size="22" /><span><b>{{ institution.fundName }}</b><small>{{ institution.etfCode }}｜季度持倉變化</small></span><ArrowRight :size="17" /></button>
    </section>
    <template v-else-if="section">
      <section class="filing-status"><div><span>持倉截止日</span><strong>{{ section.sourceAsOf || "-" }}</strong></div><div><span>資料取得日</span><strong>{{ report?.reportDate || "-" }}</strong></div><div><span>距持倉截止日</span><strong>{{ lagDays === null ? "-" : `${lagDays} 天` }}</strong></div><div><span>來源類型</span><strong>SEC 13F</strong></div></section>
      <section class="data-panel"><div class="panel-heading"><div><h2>季度持倉</h2><p>持倉截止日 {{ section.sourceAsOf }}｜資料取得日 {{ report?.reportDate }}</p></div></div>
        <ResponsiveDataTable label="13F 季度持倉" :empty="!loading && !section.topHoldings.length"><div class="filing-table"><div class="table-head"><span>標的</span><span>名稱</span><span>持倉權重</span><span>市值</span><span>類型</span></div><div v-for="row in section.topHoldings" :key="row.ticker ?? row.name" class="table-row"><span><b>{{ row.ticker ?? "-" }}</b></span><span>{{ row.name }}</span><span>{{ formatWeight(row.weightPercent,1) }}</span><span>{{ formatMoney(row.marketValue) }}</span><span>{{ row.assetType ?? row.sector ?? "Equity" }}</span></div></div><template #mobile><MobileDataCard v-for="row in section.topHoldings" :key="row.ticker ?? row.name" :label="row.ticker ?? row.name" :expandable="false"><template #title>{{ row.ticker ?? "-" }} {{ row.name }}</template><template #summary>持倉權重 {{ formatWeight(row.weightPercent,1) }}｜市值 {{ formatMoney(row.marketValue) }}<br />類型 {{ row.assetType ?? row.sector ?? "Equity" }}</template></MobileDataCard></template></ResponsiveDataTable>
      </section>
      <section class="data-panel"><div class="panel-heading"><div><h2>季度持倉變化</h2><p>13F 專用語：季度持倉變化。</p></div></div><ResponsiveDataTable label="13F 季度持倉變化" :empty="!loading && !section.weightChanges.length"><div class="change-list"><div v-for="row in section.weightChanges" :key="row.positionKey ?? row.ticker ?? row.name"><span><b>{{ row.ticker ?? "-" }}</b>{{ row.name }}</span><span>{{ formatWeight(row.currentWeightPercent,1) }}</span><strong :class="(row.deltaPp ?? 0) >= 0 ? 'positive' : 'negative'">{{ (row.deltaPp ?? 0) >= 0 ? '增持 ▲' : '減持 ▼' }} {{ formatSignedPp(row.deltaPp,1) }}</strong></div></div><template #mobile><MobileDataCard v-for="row in section.weightChanges" :key="row.positionKey ?? row.ticker ?? row.name" :label="row.ticker ?? row.name" :tone="(row.deltaPp ?? 0)>0?'increase':'decrease'" :expandable="false"><template #title>{{ row.ticker ?? "-" }} {{ row.name }}</template><template #summary>季度{{ (row.deltaPp ?? 0)>=0?'增持 ▲':'減持 ▼' }} {{ formatSignedPp(row.deltaPp,1) }}｜目前 {{ formatWeight(row.currentWeightPercent,1) }}</template></MobileDataCard></template></ResponsiveDataTable></section>
      <SourceDisclosure :source-url="section.sourceUrl" source-label="查看 SEC 或官方申報來源" :note="`13F 持倉截止日 ${section.sourceAsOf}，資料取得日 ${report?.reportDate ?? '-'}；不代表即時部位。`" />
    </template>
  </section>
</template>

<style scoped>
.view-shell{display:grid;gap:16px}.institution-hero{display:flex;align-items:flex-start;gap:18px;padding:30px;border-radius:14px;background:#152d43;color:#fff}.institution-hero>div{max-width:800px}.eyebrow{color:#f0c877;font-size:12px;font-weight:850;letter-spacing:.14em}.institution-hero h1{margin:8px 0;font-size:34px}.institution-hero p{margin:0;color:#d8e1e8;line-height:1.7}.filing-warning{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid #ead39d;border-radius:11px;background:#fff9e9;color:#725412}.filing-warning span{display:grid;gap:3px}.filing-warning small{color:#80682f}.institution-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.institution-grid button{display:grid;grid-template-columns:28px 1fr 20px;align-items:center;gap:12px;min-height:86px;padding:16px;border:1px solid #dce4e8;border-radius:12px;background:#fff;color:#34424d;text-align:left;cursor:pointer}.institution-grid button:hover{border-color:#91a6b7}.institution-grid span{display:grid;gap:5px}.institution-grid small{color:#72808b}.filing-status{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;overflow:hidden;border:1px solid #dfe6e9;border-radius:12px;background:#dfe6e9}.filing-status div{display:grid;gap:6px;padding:16px;background:#fff}.filing-status span{color:#73808b;font-size:12px}.filing-status strong{color:#273540;font-size:18px}.data-panel{padding:23px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.panel-heading{margin-bottom:16px}.panel-heading h2{margin:0 0 6px;color:#26343f}.panel-heading p{margin:0;color:#71808a}.filing-table{overflow:hidden;border:1px solid #e1e7ea;border-radius:10px}.table-head,.table-row{display:grid;grid-template-columns:.7fr 1.5fr .8fr 1fr .9fr;gap:12px;align-items:center}.table-head{padding:11px 14px;background:#f2f6f7;color:#66737e;font-size:12px;font-weight:780}.table-row{min-height:64px;padding:10px 14px;border-top:1px solid #edf1f3;color:#394752}.change-list{overflow:hidden;border:1px solid #e1e7ea;border-radius:10px}.change-list>div{display:grid;grid-template-columns:1.5fr .7fr 1fr;gap:12px;align-items:center;min-height:62px;padding:10px 14px;border-top:1px solid #edf1f3}.change-list>div:first-child{border-top:0}.change-list span:first-child{display:grid;gap:3px}.positive{color:#b93f36}.negative{color:#087b72}.error-message{margin:0;padding:13px;border:1px solid #f3c7c3;border-radius:10px;background:#fff4f3;color:#a8322a}
@media(max-width:760px){.institution-hero{padding:22px 17px}.institution-hero>svg{display:none}.institution-hero h1{font-size:29px}.institution-grid{grid-template-columns:1fr}.filing-status{grid-template-columns:1fr 1fr}.data-panel{padding:16px 12px}}
</style>
