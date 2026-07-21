<script setup lang="ts">
defineProps<{ sourceUrl?: string; sourceLabel?: string; note?: string }>();
</script>

<template>
  <aside class="source-disclosure">
    <strong>資料來源</strong>
    <span>{{ note ?? "公開資料可能因公告與申報時點不同而有延遲。" }}</span>
    <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noreferrer">{{ sourceLabel ?? "查看官方來源" }}</a>
  </aside>
</template>

<style scoped>
.source-disclosure { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; padding:12px 14px; border:1px solid #dce5e8; border-radius:10px; background:#f8fafb; color:#65727d; font-size:12px; line-height:1.55; }
.source-disclosure strong { color:#33414d; }
.source-disclosure a { margin-left:auto; color:#345986; font-weight:760; }
@media (max-width:600px) { .source-disclosure { align-items:flex-start; } .source-disclosure a { width:100%; margin-left:0; min-height:44px; display:flex; align-items:center; } }
</style>
