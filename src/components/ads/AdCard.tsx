import { defineComponent, h, type PropType } from "vue";
import type { AdItem, AdSlotName } from "../../ads/types.js";

export default defineComponent({
  name: "AdCard",
  props: {
    ad: {
      type: Object as PropType<AdItem>,
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
      const imageOnly = Boolean(props.ad.imageUrl && props.ad.imageOnly);

      return h(
        "a",
        {
          class: [
            "ad-card",
            `ad-card--${props.ad.provider}`,
            `ad-card--slot-${props.slotName}`,
            {
              "ad-card--compact": props.compact,
              "ad-card--visual": Boolean(props.ad.imageUrl),
              "ad-card--image-only": imageOnly
            }
          ],
          href: props.ad.link,
          target: "_blank",
          rel: "sponsored noopener noreferrer",
          "aria-label": `${props.ad.title}${props.ad.description ? `。${props.ad.description}` : ""}`,
          "data-ad-id": props.ad.id,
          "data-ad-slot": props.slotName,
          onClick: () => emit("ad-click", props.ad)
        },
        [
          props.ad.imageUrl
            ? h("img", {
                class: "ad-card__image",
                src: props.ad.imageUrl,
                alt: "",
                loading: "lazy",
                "aria-hidden": "true"
              })
            : h("div", { class: "ad-card__market-grid", "aria-hidden": "true" }, [
                h("span"),
                h("span"),
                h("span"),
                h("span")
              ]),
          imageOnly
            ? null
            : h("div", { class: "ad-card__content" }, [
                h("span", { class: "ad-card__provider" }, props.ad.provider),
                h("strong", { class: "ad-card__title" }, props.ad.title),
                props.ad.description ? h("span", { class: "ad-card__description" }, props.ad.description) : null,
                h("span", { class: "ad-card__cta" }, "查看市場共識 →")
              ])
        ]
      );
    };
  }
});
