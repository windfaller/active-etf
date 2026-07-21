<script setup lang="ts">
import { Building2, Globe2 } from "@lucide/vue";
import GlobalSearchDialog from "../components/search/GlobalSearchDialog.vue";
const emit = defineEmits<{ navigate: [path: string] }>();
</script>

<template>
  <section class="p1-view">
    <header class="p1-hero"><span class="eyebrow">股票情報</span><h1>從股票反查 ETF 調倉</h1><p>查看哪些 ETF 正在加碼或減碼、方向持續多久，以及 ETF 與三大法人是否一致。台灣與美國股票使用分開市場路由，避免代碼碰撞。</p></header>
    <GlobalSearchDialog mode="page" :types="['tw_stock','us_stock']" @navigate="emit('navigate',$event)" />
    <section class="stock-shortcuts"><button type="button" @click="emit('navigate','/stocks/tw/2330')"><Building2 :size="22" /><span><b>2330 台積電</b><small>台灣 ETF 主動調倉與法人方向</small></span></button><button type="button" @click="emit('navigate','/stocks/us/MU')"><Globe2 :size="22" /><span><b>MU Micron Technology</b><small>海外 ETF 曝險與 13F 季度持倉</small></span></button></section>
  </section>
</template>

<style scoped>
.p1-view{display:grid;gap:16px}.p1-hero{padding:30px;border:1px solid var(--theme-border);border-radius:15px;background:linear-gradient(135deg,#082b3c,#0d615f);color:#fff}.eyebrow{color:#63e2d2;font-size:12px;font-weight:850;letter-spacing:.13em}.p1-hero h1{margin:9px 0;font-size:36px}.p1-hero p{max-width:830px;margin:0;color:#d8ecec;line-height:1.7}.stock-shortcuts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.stock-shortcuts button{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:center;min-height:78px;padding:15px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface);color:var(--theme-text);text-align:left;cursor:pointer}.stock-shortcuts span{display:grid;gap:4px}.stock-shortcuts small{color:var(--theme-text-muted)}
@media(max-width:700px){.p1-hero{padding:23px 18px}.p1-hero h1{font-size:29px}.stock-shortcuts{grid-template-columns:1fr}}
</style>
