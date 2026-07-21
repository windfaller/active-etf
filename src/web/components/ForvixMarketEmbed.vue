<script setup lang="ts">
import { computed } from "vue";

const eventId = "106981";
const forvixOrigin = "https://www.forvix.app";
const parentOrigin = typeof window === "undefined" ? "https://active-etf.inthewins.com" : window.location.origin;

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
</script>

<template>
  <aside
    id="forvix-market-watch-embed"
    class="forvix-market-embed"
    aria-label="FORVIX 市場事件延伸閱讀"
    data-forvix-placement="content-end"
  >
    <header>
      <span>延伸閱讀 · FORVIX 市場事件</span>
      <a :href="fullPageUrl" target="_blank" rel="noopener sponsored">開啟完整頁面 ↗</a>
    </header>
    <iframe
      :src="embedUrl"
      title="FORVIX 市場事件延伸閱讀"
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      scrolling="yes"
    />
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
