<script setup lang="ts">
import { LockKeyhole } from "@lucide/vue";
import { useAuth } from "../composables/useAuth";

withDefaults(defineProps<{
  title?: string;
  description?: string;
  compact?: boolean;
  source?: string;
}>(), {
  title: "完整結果已遮隱",
  description: "免費註冊或登入後，立即查看完整資料。",
  compact: false,
  source: "member_locked_result"
});

const { isLoading, signIn } = useAuth();
</script>

<template>
  <section
    :class="['member-locked-result', { compact }]"
    data-testid="member-locked-result"
    aria-label="會員限定結果"
  >
    <div class="locked-mask" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="locked-copy">
      <span><LockKeyhole :size="compact ? 15 : 17" /> 免費會員限定</span>
      <b>{{ title }}</b>
      <small v-if="!compact">{{ description }}</small>
    </div>
    <button type="button" :disabled="isLoading" @click="signIn(source)">
      {{ isLoading ? "驗證中…" : "免費註冊／登入解鎖" }}
    </button>
  </section>
</template>

<style scoped>
.member-locked-result{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;min-height:150px;padding:20px;overflow:hidden;border:1px solid #b9c8d3;border-radius:12px;background:linear-gradient(135deg,#f5f8fa,#eaf0f4);color:var(--theme-text)}
.locked-mask{position:absolute;inset:0;display:grid;align-content:center;gap:10px;padding:20px;opacity:.45;filter:blur(5px);pointer-events:none}.locked-mask i{display:block;width:78%;height:14px;border-radius:999px;background:#adbbc5}.locked-mask i:nth-child(2){width:92%}.locked-mask i:nth-child(3){width:58%}
.locked-copy,.member-locked-result button{position:relative;z-index:1}.locked-copy{display:grid;gap:5px}.locked-copy>span{display:flex;align-items:center;gap:6px;color:#345986;font-size:11px;font-weight:850;letter-spacing:.04em}.locked-copy>b{color:var(--theme-text-strong);font-size:16px}.locked-copy>small{color:var(--theme-text-muted);line-height:1.5}
.member-locked-result button{min-height:44px;padding:0 14px;border:1px solid #234d73;border-radius:9px;background:#234d73;color:white;font-weight:850;cursor:pointer;white-space:nowrap}.member-locked-result button:hover{background:#173e62}.member-locked-result button:focus-visible{outline:3px solid rgba(35,77,115,.28);outline-offset:2px}.member-locked-result button:disabled{opacity:.6;cursor:wait}
.member-locked-result.compact{grid-template-columns:minmax(0,1fr) auto;min-height:76px;padding:12px 14px}.compact .locked-mask{padding:12px}.compact .locked-mask i{height:10px}.compact .locked-copy>b{font-size:13px}.compact button{min-height:44px;padding:0 11px;font-size:12px}
@media(max-width:600px){.member-locked-result,.member-locked-result.compact{grid-template-columns:1fr}.member-locked-result button{width:100%;white-space:normal}}
</style>
