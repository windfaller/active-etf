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
    return () =>
      h(
        "a",
        {
          class: [
            "ad-card",
            `ad-card--${props.ad.provider}`,
            {
              "ad-card--compact": props.compact,
              "ad-card--visual": Boolean(props.ad.imageUrl)
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
          h("div", { class: ["ad-card__content", { "ad-card__content--sr-only": Boolean(props.ad.imageUrl) }] }, [
            h("span", { class: "ad-card__provider" }, props.ad.provider),
            h("strong", { class: "ad-card__title" }, props.ad.title),
            props.ad.description ? h("span", { class: "ad-card__description" }, props.ad.description) : null
          ])
        ]
      );
  }
});
