<script setup lang="ts">
import GlobalSearchDialog from "../components/search/GlobalSearchDialog.vue";
defineProps<{ query: string }>();
const emit = defineEmits<{ navigate: [path: string]; query: [value: string] }>();
</script>

<template>
  <section class="search-page"><header><span>全站搜尋</span><h1>搜尋「{{ query || '股票、ETF 或訊號' }}」</h1><p>搜尋結果頁不建立索引；每筆資料日期仍以目的頁面為準。</p></header><GlobalSearchDialog mode="page" :initial-query="query" @navigate="emit('navigate',$event)" @query="emit('query',$event)" /></section>
</template>

<style scoped>
.search-page{display:grid;gap:16px}.search-page>header{padding:24px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.search-page span{color:#087b72;font-size:12px;font-weight:850;letter-spacing:.12em}.search-page h1{margin:8px 0;color:var(--theme-text-strong)}.search-page p{margin:0;color:var(--theme-text-muted)}
</style>
