<script setup lang="ts">
defineProps<{
  alignment: {
    commonDate: string | null;
    commonDateOnly: boolean;
    rows: Array<{ etfCode: string; sourceAsOf: string | null; fetchedAt: string | null }>;
  };
}>();

const formatFetchedAt = (value: string | null) => value
  ? new Date(value).toLocaleString("zh-TW", { hour12: false })
  : "未知";
</script>

<template>
  <section class="date-alignment-notice" :class="{ mixed: !alignment.commonDateOnly }" data-testid="global-date-alignment">
    <strong>{{ alignment.commonDateOnly ? `共同持股資料日：${alignment.commonDate}` : '非共同資料日' }}</strong>
    <p>{{ alignment.commonDateOnly ? '各檔海外 ETF 使用相同持股資料日。' : '各 ETF 依最新可用公開持股呈現，頁首日期只代表最新一筆資料，不代表所有 ETF 均更新至同一天。' }}</p>
    <div>
      <span v-for="row in alignment.rows" :key="row.etfCode">
        <b>{{ row.etfCode }}</b> 持股資料日 {{ row.sourceAsOf ?? '未知' }}｜最後抓取 {{ formatFetchedAt(row.fetchedAt) }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.date-alignment-notice{display:grid;gap:8px;padding:16px;border:1px solid var(--theme-border);border-left:4px solid #087b72;border-radius:11px;background:var(--theme-surface);color:var(--theme-text)}.date-alignment-notice.mixed{border-left-color:#b26a00;background:var(--theme-surface-muted)}.date-alignment-notice strong{color:var(--theme-text-strong);font-size:17px}.date-alignment-notice p{margin:0;color:var(--theme-text-muted);line-height:1.5}.date-alignment-notice div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.date-alignment-notice span{padding:8px;border-radius:7px;background:var(--theme-surface);color:var(--theme-text-muted);font-size:12px}
@media(max-width:650px){.date-alignment-notice div{grid-template-columns:1fr}}
</style>
