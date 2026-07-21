<script setup lang="ts">
import { computed } from "vue";
import type { IntelligenceConfidence, IntelligenceCoverage } from "../contracts/intelligence";
import DataFreshnessBadge from "./DataFreshnessBadge.vue";

const props = defineProps<{ sourceAsOf: string | null; generatedAt: string; coverage: IntelligenceCoverage; confidence: IntelligenceConfidence }>();
const tone = computed(() => props.confidence.level === "high" ? "fresh" : props.confidence.level === "medium" ? "delayed" : "unknown");
const confidenceLabel = computed(() => ({ high: "高", medium: "中", low: "低" })[props.confidence.level]);
</script>

<template>
  <section class="intelligence-meta" aria-label="資料日期、涵蓋率與可信度">
    <DataFreshnessBadge :label="`資料日 ${sourceAsOf ?? '未知'}`" :tone="tone" />
    <div><span>涵蓋率</span><strong>{{ coverage.available }} / {{ coverage.tracked }}</strong><small>延遲 {{ coverage.delayed }}</small></div>
    <div><span>訊號可信度</span><strong>{{ confidenceLabel }}</strong><small>{{ confidence.reason }}</small></div>
    <div><span>系統更新</span><strong>{{ new Date(generatedAt).toLocaleString('zh-TW', { hour12: false }) }}</strong><small>系統計算時間</small></div>
  </section>
</template>

<style scoped>
.intelligence-meta{display:grid;grid-template-columns:auto 130px minmax(260px,1fr) 190px;align-items:stretch;gap:1px;overflow:hidden;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-border)}.intelligence-meta>.freshness-badge{align-self:center;margin:0 14px}.intelligence-meta>div{display:grid;align-content:center;gap:3px;min-height:72px;padding:11px 14px;background:var(--theme-surface)}.intelligence-meta span,.intelligence-meta small{color:var(--theme-text-muted);font-size:11px}.intelligence-meta strong{color:var(--theme-text-strong);font-size:15px}.intelligence-meta small{line-height:1.45}
@media(max-width:820px){.intelligence-meta{grid-template-columns:1fr 1fr}.intelligence-meta>.freshness-badge{grid-column:1 / -1;justify-self:start;margin:12px}.intelligence-meta>div:nth-of-type(2){grid-column:1 / -1}.intelligence-meta>div{min-height:64px;padding:10px 12px}}
</style>
