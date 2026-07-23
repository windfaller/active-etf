<script setup lang="ts">
defineProps<{ path: string }>();
defineEmits<{ navigate: [path: string] }>();
</script>

<template>
  <section class="not-found-view">
    <span>404</span>
    <h1>找不到 ETF 或資料頁面</h1>
    <p>{{ path }} 不是目前已追蹤的路由。未知 ETF 代碼不會自動切換到預設 ETF。</p>
    <a href="/" @click.prevent="$emit('navigate','/')">回到今日情報</a>
  </section>
</template>

<style scoped>
.not-found-view{display:grid;justify-items:start;gap:12px;padding:48px;border:1px solid #dfe6e9;border-radius:14px;background:#fff}.not-found-view>span{color:#087b72;font-size:13px;font-weight:900;letter-spacing:.18em}.not-found-view h1{margin:0;color:#21303c;font-size:34px}.not-found-view p{max-width:700px;margin:0;color:#697680;line-height:1.7}.not-found-view a{display:flex;align-items:center;min-height:44px;margin-top:8px;padding:0 16px;border-radius:9px;background:#173f56;color:#fff;font-weight:780;text-decoration:none}
@media(max-width:760px){.not-found-view{padding:28px 18px}.not-found-view h1{font-size:28px}}
</style>
