<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  denyTrackingConsent,
  grantTrackingConsent,
  readBrowserTrackingConsent,
  TRACKING_CONSENT_CHANGED_EVENT,
  type TrackingConsent
} from "../consent";

const initialChoice = readBrowserTrackingConsent();
const visible = ref(initialChoice === null);
const currentChoice = ref<TrackingConsent | null>(initialChoice);

function open(): void {
  currentChoice.value = readBrowserTrackingConsent();
  visible.value = true;
}

function syncChoice(): void {
  currentChoice.value = readBrowserTrackingConsent();
  if (currentChoice.value === "granted") visible.value = false;
}

function accept(): void {
  grantTrackingConsent();
  currentChoice.value = "granted";
  visible.value = false;
}

function reject(): void {
  const mustReload = currentChoice.value === "granted";
  denyTrackingConsent();
  currentChoice.value = "denied";
  visible.value = false;
  if (mustReload) window.location.reload();
}

onMounted(() => window.addEventListener(TRACKING_CONSENT_CHANGED_EVENT, syncChoice));
onBeforeUnmount(() => window.removeEventListener(TRACKING_CONSENT_CHANGED_EVENT, syncChoice));

defineExpose({ open });
</script>

<template>
  <section v-if="visible" class="tracking-consent" role="dialog" aria-labelledby="tracking-consent-title" data-tracking-consent-ui>
    <div>
      <span>隱私與追蹤設定</span>
      <h2 id="tracking-consent-title">匿名量測與完整追蹤</h2>
      <p>進站時 Google 會以 Consent Mode denied 進行無 Cookie 的受限匿名量測，Meta Pixel 與 Forvix 跨站內容不會啟動。操作分頁、點擊內容或功能，或進入登入／加入會員流程，即視為同意升級完整成效分析；事件不含會員識別、搜尋字或股票與 ETF 代碼。</p>
      <nav aria-label="追蹤設定說明">
        <a href="/privacy">隱私政策</a>
        <a href="/terms">服務條款</a>
      </nav>
    </div>
    <div class="tracking-consent__actions">
      <button type="button" class="secondary" @click="reject">維持匿名量測</button>
      <button type="button" class="primary" @click="accept">同意完整量測</button>
    </div>
  </section>
</template>

<style scoped>
.tracking-consent{position:fixed;left:50%;bottom:18px;z-index:150;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:20px;width:min(920px,calc(100% - 28px));padding:20px;transform:translateX(-50%);border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface);box-shadow:0 18px 60px rgba(7,25,38,.24);color:var(--theme-text)}
.tracking-consent>div:first-child{display:grid;gap:6px}.tracking-consent span{color:#0b766f;font-size:11px;font-weight:850;letter-spacing:.09em}.tracking-consent h2{margin:0;color:var(--theme-text-strong);font-size:19px}.tracking-consent p{max-width:700px;margin:0;color:var(--theme-text-muted);font-size:13px;line-height:1.65}.tracking-consent nav{display:flex;gap:14px}.tracking-consent a{color:#345986;font-size:12px;font-weight:760}.tracking-consent__actions{display:flex;gap:8px}.tracking-consent button{min-height:44px;padding:0 14px;border-radius:9px;font-weight:800;cursor:pointer}.tracking-consent .secondary{border:1px solid var(--theme-border);background:var(--theme-surface-muted);color:var(--theme-text)}.tracking-consent .primary{border:1px solid #0b766f;background:#0b766f;color:#fff}
@media(max-width:760px){.tracking-consent{bottom:10px;grid-template-columns:1fr;gap:14px;padding:17px}.tracking-consent__actions{display:grid;grid-template-columns:1fr}.tracking-consent button{width:100%}}
</style>
