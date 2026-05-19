import { defineComponent, h, type PropType } from "vue";
import type { AdItem, AdSlotName } from "../../ads/types.js";
import AdCard from "./AdCard.js";

export default defineComponent({
  name: "AdCarousel",
  props: {
    ads: {
      type: Array as PropType<AdItem[]>,
      required: true
    },
    slotName: {
      type: String as PropType<AdSlotName>,
      required: true
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

      return h(
        "div",
        {
          class: "ad-carousel",
          role: "list",
          "aria-label": "Sponsored placements"
        },
        props.ads.map((ad) =>
          h(
            "div",
            {
              key: ad.id,
              class: "ad-carousel__item",
              role: "listitem"
            },
            [
              h(AdCard, {
                ad,
                slotName: props.slotName,
                compact: props.compact,
                onAdClick: (clickedAd: AdItem) => emit("ad-click", clickedAd)
              })
            ]
          )
        )
      );
    };
  }
});
