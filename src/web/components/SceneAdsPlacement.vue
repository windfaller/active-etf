<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { loadSceneAdsSdk, SCENE_ADS_PROJECT_ID, type SceneAdsClient } from "../../ads/gogoSceneAds";
import { useAdsRuntimeConfig } from "../../ads/runtimeConfig";

const props = defineProps<{ routeKey: string; contentLoading?: boolean }>();

const { adsEnabled } = useAdsRuntimeConfig();
const host = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const loading = ref(false);
const ready = ref(false);
const managerEnabled = ref(false);
const collection = ref("all");
const groups = ref<{ id: string; label: string }[]>([]);
const status = ref("idle");
const creativeId = ref<string | null>(null);
const compact = ref(false);
let client: SceneAdsClient | null = null;
let observer: IntersectionObserver | null = null;
let media: MediaQueryList | null = null;
let unsubscribe: (() => void) | null = null;
let unbind: (() => void) | null = null;
let destroyed = false;
let lifecycle = 0;
let started = false;

function redraw(): void {
  if (!client || !canvas.value) return;
  // Use the same live canvas for both shapes; the SDK records the displayed creative.
  canvas.value.width = compact.value ? 640 : 1200;
  canvas.value.height = compact.value ? 640 : 628;
  const index = [...props.routeKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  creativeId.value = client.draw(canvas.value, index);
  // Explicitly bind only after a successful draw. No surrounding element opens links.
  if (creativeId.value && !unbind) unbind = client.bindClick(canvas.value);
}

function sync(): void {
  if (!client || destroyed) return;
  ready.value = !!client.config;
  managerEnabled.value = client.config?.enabled === true;
  collection.value = client.collection;
  groups.value = client.catalog?.groups ?? [];
  status.value = client.status;
  redraw();
}

async function load(): Promise<void> {
  if (loading.value || destroyed || !adsEnabled.value) return;
  const epoch = lifecycle;
  started = true;
  loading.value = true;
  observer?.disconnect();
  try {
    if (!client) {
      const sdk = await loadSceneAdsSdk();
      if (destroyed || epoch !== lifecycle || !adsEnabled.value) return;
      // Local preferences only. Keep the SDK's public shared-webp policy defaults.
      client = new sdk.Client({ projectId: SCENE_ADS_PROJECT_ID });
      // Host policy: migrate only the obsolete opt-out; preserve projectId and collection.
      // The shared manager config.enabled and host ads.enabled still take precedence.
      client.setEnabled(true);
      unsubscribe = client.subscribe(sync);
    }
    await client.load();
    sync();
  } catch {
    if (!destroyed && epoch === lifecycle) status.value = "unavailable";
  } finally {
    if (!destroyed && epoch === lifecycle) loading.value = false;
  }
}

function resize(): void {
  compact.value = media?.matches ?? false;
  redraw();
}

function release(): void {
  lifecycle += 1;
  loading.value = false;
  unsubscribe?.(); unsubscribe = null;
  unbind?.(); unbind = null;
  client?.dispose(); client = null;
}

function restore(event: PageTransitionEvent): void {
  if (event.persisted && started) void load();
}

watch(host, (element) => {
  observer?.disconnect();
  if (!element) { release(); return; }
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void load();
    }, { rootMargin: "200px 0px" });
    observer.observe(element);
  } else {
    void load();
  }
}, { flush: "post" });

watch(() => props.routeKey, redraw);

onMounted(() => {
  media = window.matchMedia("(max-width: 600px)");
  resize();
  media.addEventListener("change", resize);
  window.addEventListener("pagehide", release);
  window.addEventListener("pageshow", restore);
});

onBeforeUnmount(() => {
  destroyed = true;
  observer?.disconnect();
  media?.removeEventListener("change", resize);
  window.removeEventListener("pagehide", release);
  window.removeEventListener("pageshow", restore);
  release();
});
</script>

<template>
  <aside v-if="adsEnabled" ref="host" class="scene-ads" data-gogo-scene-ads aria-label="合作廣告">
    <header>
      <div class="scene-ads__heading"><span>合作廣告</span><small v-if="contentLoading">資料載入中，可先查看合作內容</small></div>
      <div class="scene-ads__settings">
        <label>分類<select :value="collection" :disabled="!ready || !managerEnabled" @change="client?.setCollection(($event.target as HTMLSelectElement).value)"><option value="all">全部</option><option v-for="group in groups" :key="group.id" :value="group.id">{{ group.label }}</option></select></label>
      </div>
    </header>
    <div v-show="creativeId" class="scene-ads__image" :class="{ square: compact }">
      <canvas ref="canvas" width="1200" height="628" :data-creative-id="creativeId">合作廣告，圖片載入後可開啟目標頁。</canvas>
    </div>
    <div v-if="!creativeId || status === 'last-good'" class="scene-ads__status" role="status">
      <span>{{ loading ? '廣告載入中…' : status === 'idle' ? '捲動至此處時載入廣告' : ready && !managerEnabled ? '廣告目前由管理員關閉' : status === 'last-good' ? '暫時無法更新，保留已驗證廣告' : '廣告暫時無法載入' }}</span>
      <button v-if="status === 'unavailable' || status === 'last-good'" type="button" :disabled="loading" @click="load">重試</button>
    </div>
  </aside>
</template>

<style scoped>
.scene-ads{min-width:0;padding:12px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface)}
.scene-ads header{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--theme-text-muted);font-size:12px}
.scene-ads__settings{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.scene-ads label{display:flex;align-items:center;gap:6px;min-height:44px}
.scene-ads__heading{display:grid;gap:6px}.scene-ads__heading small{font-size:11px;line-height:1.5}
.scene-ads select,.scene-ads button{min-height:44px;padding:0 10px;border:1px solid var(--theme-border);border-radius:8px;background:var(--theme-surface-muted);color:var(--theme-text)}
.scene-ads__image{width:min(100%,520px);aspect-ratio:1200/628;margin:10px auto 0}
.scene-ads__image.square{width:min(100%,160px);aspect-ratio:1}
.scene-ads canvas{display:block;width:100%;height:100%;border-radius:6px}
.scene-ads canvas:focus-visible{outline:3px solid #0d7770;outline-offset:4px}
.scene-ads__status{display:flex;align-items:center;justify-content:center;gap:12px;min-height:44px;color:var(--theme-text-muted);font-size:12px}
@media(min-width:601px) and (max-width:1180px){.scene-ads{display:grid;grid-template-columns:minmax(150px,1fr) minmax(0,320px);gap:12px}.scene-ads header{align-items:flex-start;flex-direction:column;justify-content:center}.scene-ads__image{margin:0}.scene-ads__status{grid-column:1/-1}}
@media(max-width:600px){.scene-ads{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:10px}.scene-ads header{align-items:flex-start;flex-direction:column;justify-content:center}.scene-ads__image{margin:0}.scene-ads__settings{gap:10px}.scene-ads__status{grid-column:1/-1;flex-wrap:wrap}}
</style>
