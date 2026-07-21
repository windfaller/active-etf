<script setup lang="ts">
withDefaults(defineProps<{ label: string; tone?: "increase" | "decrease" | "neutral"; open?: boolean; expandable?: boolean }>(), { tone: "neutral", open: false, expandable: true });
</script>

<template>
  <details v-if="expandable" class="mobile-data-card" :class="tone" :open="open">
    <summary :aria-label="`展開 ${label} 詳細資料`">
      <span class="mobile-card-title"><slot name="title" /></span>
      <span class="mobile-card-summary"><slot name="summary" /></span>
      <span class="mobile-card-toggle" aria-hidden="true">詳情 <b>⌄</b>
      </span>
    </summary>
    <div class="mobile-card-detail"><slot /></div>
  </details>
  <article v-else class="mobile-data-card mobile-data-card-static" :class="tone" :aria-label="label">
    <span class="mobile-card-title"><slot name="title" /></span>
    <span class="mobile-card-summary"><slot name="summary" /></span>
  </article>
</template>

<style scoped>
.mobile-data-card { overflow:hidden; border:1px solid #dfe6e9; border-left:4px solid #7b8791; border-radius:12px; background:#fff; }
.mobile-data-card.increase { border-left-color:#c84238; }
.mobile-data-card.decrease { border-left-color:#07847d; }
summary { display:grid; gap:7px; min-height:74px; padding:13px 14px; cursor:pointer; list-style:none; }
.mobile-data-card-static { display:grid; gap:7px; min-height:74px; padding:13px 14px; }
summary::-webkit-details-marker { display:none; }
summary:focus-visible { outline:3px solid rgba(52,89,134,.28); outline-offset:-3px; }
.mobile-card-title { color:#25313c; font-size:15px; font-weight:820; }
.mobile-card-summary { color:#43515e; font-size:13px; line-height:1.55; }
.mobile-card-toggle { justify-self:end; min-height:24px; color:#4a6178; font-size:12px; font-weight:750; }
.mobile-card-toggle b { display:inline-block; margin-left:4px; transition:transform .15s ease; }
details[open] .mobile-card-toggle b { transform:rotate(180deg); }
.mobile-card-detail { padding:14px; border-top:1px solid #edf1f3; background:#f8fafb; color:#46535e; font-size:13px; line-height:1.65; }
</style>
