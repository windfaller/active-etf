import { defineComponent, h, onMounted, watch, type PropType } from "vue";
import { trackAdClick, trackAdImpression } from "../../ads/tracking.js";
import { useAdSlot } from "../../ads/hooks.js";
import type { AdItem, AdRenderMode, AdSlotName } from "../../ads/types.js";
import AdRenderer from "./AdRenderer.js";

/*
Future page usage examples:
<AdSlot slot="hero-banner" />
<AdSlot slot="sidebar-top" />
<AdSlot slot="article-inline" />
*/
export default defineComponent({
  name: "AdSlot",
  props: {
    slot: {
      type: String as PropType<AdSlotName>,
      required: true
    },
    mode: {
      type: String as PropType<AdRenderMode>,
      default: "card"
    },
    compact: {
      type: Boolean,
      default: false
    },
    page: {
      type: String,
      default: ""
    },
    etfCode: {
      type: String,
      default: undefined
    },
    tags: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },
  setup(props) {
    const { ads, enabled } = useAdSlot(props.slot, {
      page: props.page,
      etfCode: props.etfCode,
      tags: props.tags,
      mode: props.mode,
      limit: props.mode === "carousel" ? 3 : 1
    });
    const seenImpressions = new Set<string>();

    function pagePath(): string {
      if (props.page) return props.page;
      if (typeof window === "undefined") return "/";
      return window.location.pathname;
    }

    function recordImpressions() {
      if (!enabled.value) return;

      for (const ad of ads.value) {
        const key = `${props.slot}:${ad.id}`;
        if (seenImpressions.has(key)) continue;
        seenImpressions.add(key);
        void trackAdImpression({
          ad,
          slot: props.slot,
          page: pagePath(),
          etfCode: props.etfCode
        });
      }
    }

    function recordClick(ad: AdItem) {
      void trackAdClick({
        ad,
        slot: props.slot,
        page: pagePath(),
        etfCode: props.etfCode
      });
    }

    onMounted(recordImpressions);
    watch(ads, recordImpressions);

    return () => {
      if (!enabled.value || !ads.value.length) return null;

      return h(AdRenderer, {
        ads: ads.value,
        slotName: props.slot,
        mode: props.mode,
        compact: props.compact,
        onAdClick: recordClick
      });
    };
  }
});
