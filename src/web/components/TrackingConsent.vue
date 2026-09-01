<script setup lang="ts">
import { ref } from "vue";
import {
  denyTrackingConsent,
  grantTrackingConsent,
  readBrowserTrackingConsent,
  type TrackingConsent
} from "../consent";

const initialChoice = readBrowserTrackingConsent();
const visible = ref(initialChoice === null);
const currentChoice = ref<TrackingConsent | null>(initialChoice);

function open(): void {
  visible.value = true;
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

defineExpose({ open });
</script>

<template>
  <section v-if="visible" class="tracking-consent" role="dialog" aria-labelledby="tracking-consent-title">
    <div>
      <span>隱私與追蹤設定</span>
      <h2 id="tracking-consent-title">由你決定是否允許成效分析</h2>
      <p>必要功能會維持登入、會員遮罩與介面偏好。只有在你同意後，本站才會載入 Google Analytics、Google Ads 與 Meta Pixel；拒絕不影響資料查詢與會員功能。</p>
      <nav aria-label="追蹤設定說明">
        <a href="/privacy">隱私政策</a>
        <a href="/terms">服務條款</a>
      </nav>
    </div>
    <div class="tracking-consent__actions">
      <button type="button" class="secondary" @click="reject">僅使用必要功能</button>
      <button type="button" class="primary" @click="accept">允許成效分析</button>
    </div>
  </section>
</template>

<style scoped>
.tracking-consent{position:fixed;left:50%;bottom:18px;z-index:150;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:20px;width:min(920px,calc(100% - 28px));padding:20px;transform:translateX(-50%);border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface);box-shadow:0 18px 60px rgba(7,25,38,.24);color:var(--theme-text)}
.tracking-consent>div:first-child{display:grid;gap:6px}.tracking-consent span{color:#0b766f;font-size:11px;font-weight:850;letter-spacing:.09em}.tracking-consent h2{margin:0;color:var(--theme-text-strong);font-size:19px}.tracking-consent p{max-width:700px;margin:0;color:var(--theme-text-muted);font-size:13px;line-height:1.65}.tracking-consent nav{display:flex;gap:14px}.tracking-consent a{color:#345986;font-size:12px;font-weight:760}.tracking-consent__actions{display:flex;gap:8px}.tracking-consent button{min-height:44px;padding:0 14px;border-radius:9px;font-weight:800;cursor:pointer}.tracking-consent .secondary{border:1px solid var(--theme-border);background:var(--theme-surface-muted);color:var(--theme-text)}.tracking-consent .primary{border:1px solid #0b766f;background:#0b766f;color:#fff}
@media(max-width:760px){.tracking-consent{bottom:10px;grid-template-columns:1fr;gap:14px;padding:17px}.tracking-consent__actions{display:grid;grid-template-columns:1fr}.tracking-consent button{width:100%}}
</style>
