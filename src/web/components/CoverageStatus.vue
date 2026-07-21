<script setup lang="ts">
import { computed } from "vue";
import type { EtfCoverageResponse } from "../contracts/dashboard";
import { coverageConfidence } from "../domain/dailyBrief";

const props = defineProps<{ coverage: EtfCoverageResponse | null; sampleCount: number; compact?: boolean }>();
const confidence = computed(() => coverageConfidence(props.coverage, props.sampleCount));
</script>

<template>
  <section class="coverage-status" :class="[confidence.level, { compact }]" aria-label="資料涵蓋與訊號可信度">
    <div>
      <span>已更新 ETF</span>
      <strong>{{ coverage?.availableCount ?? 0 }} / {{ coverage?.trackedCount ?? 0 }}</strong>
    </div>
    <div>
      <span>延遲 ETF</span>
      <strong>{{ coverage?.staleCount ?? 0 }}</strong>
    </div>
    <div class="confidence-copy">
      <span>訊號可信度</span>
      <strong>{{ confidence.label }}</strong>
      <small>{{ confidence.explanation }}</small>
    </div>
  </section>
</template>

<style scoped>
.coverage-status { display:grid; grid-template-columns:140px 120px minmax(260px,1fr); gap:1px; overflow:hidden; border:1px solid #dfe6e9; border-radius:12px; background:#dfe6e9; }
.coverage-status > div { display:grid; align-content:center; gap:4px; min-height:82px; padding:14px 16px; background:#fff; }
.coverage-status span { color:#687580; font-size:12px; font-weight:720; }
.coverage-status strong { color:#25313c; font-size:19px; }
.coverage-status small { color:#66727d; line-height:1.45; }
.coverage-status.high .confidence-copy strong { color:#087b72; }
.coverage-status.medium .confidence-copy strong { color:#9a6700; }
.coverage-status.low .confidence-copy strong { color:#b42318; }
.coverage-status.compact > div { min-height:68px; }
@media (max-width:760px) { .coverage-status { grid-template-columns:1fr 1fr; } .confidence-copy { grid-column:1 / -1; } .coverage-status > div { min-height:70px; padding:12px; } }
</style>
