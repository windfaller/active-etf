<script setup lang="ts">
defineProps<{ label: string; tone?: "fresh" | "delayed" | "unknown" }>();
</script>

<template>
  <span class="freshness-badge" :class="tone ?? 'unknown'">
    <i aria-hidden="true"></i>{{ label }}
  </span>
</template>

<style scoped>
.freshness-badge { display:inline-flex; align-items:center; gap:7px; min-height:30px; padding:5px 10px; border:1px solid #dce4e8; border-radius:999px; background:#f7f9fa; color:#52606d; font-size:12px; font-weight:750; }
.freshness-badge i { width:7px; height:7px; border-radius:50%; background:#82909c; }
.freshness-badge.fresh i { background:#07847d; box-shadow:0 0 0 3px rgba(7,132,125,.13); }
.freshness-badge.delayed i { background:#b7791f; }
</style>
