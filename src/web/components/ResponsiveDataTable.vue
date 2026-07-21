<script setup lang="ts">
defineProps<{ label: string; empty?: boolean; emptyText?: string }>();
</script>

<template>
  <section class="responsive-data" :aria-label="label">
    <div class="desktop-data"><slot /></div>
    <div class="mobile-data"><slot name="mobile" /></div>
    <p v-if="empty" class="responsive-empty">{{ emptyText ?? "目前尚無可顯示資料。" }}</p>
  </section>
</template>

<style scoped>
.mobile-data { display:none; }
.responsive-empty { margin:0; padding:24px; color:#697681; text-align:center; }
@media (max-width:760px) { .desktop-data { display:none; } .mobile-data { display:grid; gap:10px; } }
</style>
