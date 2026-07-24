<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const eventId = "106981";
const forvixOrigin = "https://www.forvix.app";
const parentOrigin = typeof window === "undefined" ? "https://active-etf.inthewins.com" : window.location.origin;
const host = ref<HTMLElement | null>(null);
const shouldLoad = ref(false);
let observer: IntersectionObserver | null = null;
let fallbackTimer: number | null = null;

const embedUrl = computed(() => {
  const params = new URLSearchParams({
    lang: "zh-TW",
    targetOrigin: parentOrigin
  });
  return `${forvixOrigin}/market-watch/embed/${eventId}?${params.toString()}`;
});

const fullPageUrl = computed(() => {
  const params = new URLSearchParams({
    lang: "zh-TW",
    utm_source: "active-etf",
    utm_medium: "embed",
    utm_campaign: "market-watch"
  });
  return `${forvixOrigin}/market-watch/${eventId}?${params.toString()}`;
});

function loadEmbed(): void {
  shouldLoad.value = true;
  observer?.disconnect();
  observer = null;
  if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
  fallbackTimer = null;
}

onMounted(() => {
  if ("IntersectionObserver" in window && host.value) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadEmbed();
    }, { rootMargin: "500px 0px" });
    observer.observe(host.value);
    return;
  }
  fallbackTimer = window.setTimeout(loadEmbed, 2500);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
});
</script>

<template>
  <aside
    id="forvix-market-watch-embed"
    ref="host"
    class="forvix-market-embed"
    aria-label="FORVIX 市場事件延伸閱讀"
    data-forvix-placement="content-end"
  >
    <header>
      <span>延伸閱讀 · FORVIX 市場事件</span>
      <a :href="fullPageUrl" target="_blank" rel="noopener sponsored">開啟完整頁面 ↗</a>
    </header>
    <iframe
      v-if="shouldLoad"
      :src="embedUrl"
      title="FORVIX 市場事件延伸閱讀"
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      scrolling="yes"
    />
    <div v-else class="embed-placeholder" aria-hidden="true">延伸閱讀將在捲動至此處時載入</div>
  </aside>
</template>

<style scoped>
.forvix-market-embed {
  width: 100%;
  margin: 4px 0 6px;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: var(--theme-surface);
}

.forvix-market-embed header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--theme-border);
  color: var(--theme-text-muted);
}

.forvix-market-embed header span {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .04em;
}

.forvix-market-embed header a {
  color: #4f789e;
  font-size: 12px;
  font-weight: 750;
  text-decoration: none;
  white-space: nowrap;
}

.forvix-market-embed iframe {
  display: block;
  width: 100%;
  height: 560px;
  border: 0;
  background: #020617;
}

.embed-placeholder {
  display: grid;
  place-items: center;
  min-height: 160px;
  padding: 24px;
  background: var(--theme-surface-muted);
  color: var(--theme-text-muted);
  font-size: 12px;
}

:global([data-theme="dark"]) .forvix-market-embed header a {
  color: #8eb9df;
}

@media (max-width: 760px) {
  .forvix-market-embed header {
    align-items: flex-start;
  }

  .forvix-market-embed header span {
    line-height: 1.45;
  }

  .forvix-market-embed iframe {
    height: 500px;
  }
}
</style>
