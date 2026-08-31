<script setup lang="ts">
import { computed } from "vue";
import { Database } from "@lucide/vue";
import MemberLockedResult from "../components/MemberLockedResult.vue";
import MobileDataCard from "../components/MobileDataCard.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import SourceDisclosure from "../components/SourceDisclosure.vue";
import { useAuth } from "../composables/useAuth";
import type { GlobalEtfOption, GlobalReport } from "../contracts/global";
import { shouldMaskMemberResult } from "../domain/memberVisibility";
import { formatMoney, formatSignedPp, formatWeight, valueTone } from "../utils/format";

const props = defineProps<{ report: GlobalReport | null; options: GlobalEtfOption[]; selectedCode: string; loading: boolean; error: string }>();
const emit = defineEmits<{ select: [code: string] }>();
const { isAuthenticated } = useAuth();
const etfOptions = computed(() => props.options.filter((row) => row.strategyType !== "13f"));
const section = computed(() => props.report?.sections.find((row) => row.etfCode === props.selectedCode && row.strategyType !== "13f") ?? null);
function deltaFor(ticker: string | undefined, name: string): number | undefined { return section.value?.weightChanges.find((row) => (row.ticker ?? row.name) === (ticker ?? name))?.deltaPp; }
function componentSummary(index: number): string { const row = section.value?.topHoldings[index]; if (!row?.exposureComponents?.length) return ""; return row.exposureComponents.map((part) => `${part.ticker ?? part.name} ${formatWeight(part.weightPercent,1)}`).join(" / "); }
</script>

<template>
  <section class="global-etf-view view-shell">
    <header class="view-heading"><div><span class="eyebrow">海外單檔 ETF</span><h1>{{ section?.etfCode ?? selectedCode }} {{ section?.fundName ?? "載入中" }}</h1><p>{{ section?.issuer ?? "-" }}｜持股資料日 {{ section?.sourceAsOf ?? "-" }}</p></div><label><span>選擇海外 ETF</span><select :value="selectedCode" @change="emit('select',($event.target as HTMLSelectElement).value)"><option v-for="etf in etfOptions" :key="etf.etfCode" :value="etf.etfCode">{{ etf.etfCode }} {{ etf.fundName }}</option></select></label></header>
    <p v-if="error" class="error-message">{{ error }}</p>
    <section class="data-panel"><div class="panel-heading"><div><h2><Database :size="19" /> 官方持股</h2><p>權重變化是與前期官方持股比較，不一律代表經理人主動決策。</p></div></div>
      <ResponsiveDataTable label="海外 ETF 持股" :empty="!loading && !section?.topHoldings.length">
        <div class="global-table"><div class="table-head"><span>標的</span><span>名稱</span><span>權重</span><span>較前期</span><span>類型／組成</span></div><template v-for="(row,index) in section?.topHoldings ?? []" :key="row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="持股資料已遮隱" :source="`global_holding_${index + 1}`" /><div v-else class="table-row"><span><b>{{ row.ticker ?? "-" }}</b></span><span>{{ row.name }}</span><span>{{ formatWeight(row.weightPercent,1) }}</span><span :class="valueTone(deltaFor(row.ticker,row.name))">{{ formatSignedPp(deltaFor(row.ticker,row.name),1) }}</span><span>{{ componentSummary(index) || row.sector || row.assetType || "-" }}</span></div></template></div>
        <template #mobile><template v-for="(row,index) in section?.topHoldings ?? []" :key="row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="持股資料已遮隱" :source="`global_holding_mobile_${index + 1}`" /><MobileDataCard v-else :label="row.ticker ?? row.name" :tone="(deltaFor(row.ticker,row.name) ?? 0) > 0 ? 'increase' : (deltaFor(row.ticker,row.name) ?? 0) < 0 ? 'decrease' : 'neutral'" :expandable="false"><template #title>{{ row.ticker ?? "-" }} {{ row.name }}</template><template #summary>權重 {{ formatWeight(row.weightPercent,1) }}｜<span :class="valueTone(deltaFor(row.ticker,row.name))">較前期 {{ formatSignedPp(deltaFor(row.ticker,row.name),1) }}</span><br />{{ componentSummary(index) || row.assetType || row.sector || "-" }}｜市值 {{ formatMoney(row.marketValue) }}</template></MobileDataCard></template></template>
      </ResponsiveDataTable>
    </section>
    <section class="data-panel"><div class="panel-heading"><div><h2>持股權重變化</h2><p>海外 ETF 使用「持股權重變化」用語。</p></div></div>
      <ResponsiveDataTable label="海外 ETF 權重變化" :empty="!loading && !section?.weightChanges.length"><div class="change-list"><template v-for="(row,index) in section?.weightChanges ?? []" :key="row.positionKey ?? row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="權重變化已遮隱" :source="`global_change_${index + 1}`" /><div v-else><span><b>{{ row.ticker ?? "-" }}</b>{{ row.name }}</span><span>{{ formatWeight(row.currentWeightPercent,1) }}</span><strong :class="valueTone(row.deltaPp)">{{ (row.deltaPp ?? 0) > 0 ? '增加 ▲' : (row.deltaPp ?? 0) < 0 ? '減少 ▼' : '持平' }} {{ formatSignedPp(row.deltaPp,1) }}</strong></div></template></div><template #mobile><template v-for="(row,index) in section?.weightChanges ?? []" :key="row.positionKey ?? row.ticker ?? row.name"><MemberLockedResult v-if="shouldMaskMemberResult(isAuthenticated,index)" compact title="權重變化已遮隱" :source="`global_change_mobile_${index + 1}`" /><MobileDataCard v-else :label="row.ticker ?? row.name" :tone="(row.deltaPp ?? 0) > 0 ? 'increase' : (row.deltaPp ?? 0) < 0 ? 'decrease' : 'neutral'" :expandable="false"><template #title>{{ row.ticker ?? "-" }} {{ row.name }}</template><template #summary><span :class="valueTone(row.deltaPp)">{{ (row.deltaPp ?? 0) > 0 ? '權重增加 ▲' : (row.deltaPp ?? 0) < 0 ? '權重減少 ▼' : '權重持平' }} {{ formatSignedPp(row.deltaPp,1) }}</span>｜目前 {{ formatWeight(row.currentWeightPercent,1) }}</template></MobileDataCard></template></template></ResponsiveDataTable>
    </section>
    <SourceDisclosure :source-url="section?.sourceUrl" :note="`${section?.issuer ?? '發行商'}官方公開持股，資料日 ${section?.sourceAsOf ?? '-'}。`" />
  </section>
</template>

<style scoped>
.view-shell{display:grid;gap:16px}.view-heading{display:flex;justify-content:space-between;gap:24px;padding:28px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.eyebrow{color:#087b72;font-size:12px;font-weight:850;letter-spacing:.12em}.view-heading h1{margin:8px 0 7px;color:#1e2c38;font-size:31px}.view-heading p{margin:0;color:#6d7984}.view-heading label{display:grid;gap:6px;align-self:center;color:#64717c;font-size:12px;font-weight:760}.view-heading select{min-width:310px;height:44px;padding:0 12px;border:1px solid #d6dfe3;border-radius:9px;background:#fff}.data-panel{padding:23px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.panel-heading{margin-bottom:16px}.panel-heading h2{display:flex;align-items:center;gap:8px;margin:0 0 6px;color:#26343f}.panel-heading p{margin:0;color:#71808a}.global-table{overflow:hidden;border:1px solid #e1e7ea;border-radius:10px}.table-head,.table-row{display:grid;grid-template-columns:.7fr 1.4fr .7fr .8fr 1.5fr;gap:12px;align-items:center}.table-head{padding:11px 14px;background:#f2f6f7;color:#66737e;font-size:12px;font-weight:780}.table-row{min-height:64px;padding:10px 14px;border-top:1px solid #edf1f3;color:#394752}.positive{color:var(--theme-positive);font-weight:780}.negative{color:var(--theme-negative);font-weight:780}.neutral{color:var(--theme-neutral);font-weight:780}.change-list{overflow:hidden;border:1px solid #e1e7ea;border-radius:10px}.change-list>div{display:grid;grid-template-columns:1.5fr .7fr 1fr;gap:12px;align-items:center;min-height:62px;padding:10px 14px;border-top:1px solid #edf1f3}.change-list>div:first-child{border-top:0}.change-list span:first-child{display:grid;gap:3px}.error-message{margin:0;padding:13px;border:1px solid #f3c7c3;border-radius:10px;background:#fff4f3;color:#a8322a}
@media(max-width:760px){.view-heading{display:grid;padding:20px 16px}.view-heading h1{font-size:27px}.view-heading select{width:100%;min-width:0}.data-panel{padding:16px 12px}}
</style>
