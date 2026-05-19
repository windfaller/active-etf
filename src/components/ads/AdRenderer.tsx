import { defineComponent, h, type PropType } from "vue";
import type { AdItem, AdRenderMode, AdSlotName } from "../../ads/types.js";
import AdCard from "./AdCard.js";
import AdCarousel from "./AdCarousel.js";
import "./ads.css";

export default defineComponent({
  name: "AdRenderer",
  props: {
    ads: {
      type: Array as PropType<AdItem[]>,
      required: true
    },
    slotName: {
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
    }
  },
  emits: ["ad-click"],
  setup(props, { emit }) {
    return () => {
      if (!props.ads.length) return null;

      if (props.mode === "carousel") {
        return h(AdCarousel, {
          ads: props.ads,
          slotName: props.slotName,
          compact: props.compact,
          onAdClick: (ad: AdItem) => emit("ad-click", ad)
        });
      }

      return h(AdCard, {
        ad: props.ads[0],
        slotName: props.slotName,
        compact: props.compact || props.mode === "compact" || props.mode === "telegram",
        onAdClick: (ad: AdItem) => emit("ad-click", ad)
      });
    };
  }
});
