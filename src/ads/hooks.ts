import { computed, type ComputedRef } from "vue";
import { getRegisteredAds } from "./registry.js";
import { useAdsRuntimeConfig } from "./runtimeConfig.js";
import { selectAdsForSlot } from "./selector.js";
import type { AdItem, AdRenderMode, AdSelectionContext, AdSlotName } from "./types.js";

export interface UseAdSlotOptions {
  page?: string;
  etfCode?: string;
  tags?: string[];
  limit?: number;
  mode?: AdRenderMode;
  now?: Date;
}

export interface UseAdSlotResult {
  ads: ComputedRef<AdItem[]>;
  ad: ComputedRef<AdItem | null>;
  enabled: ComputedRef<boolean>;
}

export function useAdSlot(slot: AdSlotName, options: UseAdSlotOptions = {}): UseAdSlotResult {
  const runtimeConfig = useAdsRuntimeConfig();
  const enabled = computed(() => runtimeConfig.adsEnabled.value);
  const context = computed<AdSelectionContext>(() => ({
    slot,
    now: options.now,
    tags: options.tags,
    limit: options.limit ?? (options.mode === "carousel" ? 3 : 1)
  }));

  const ads = computed(() => (enabled.value ? selectAdsForSlot(getRegisteredAds(), context.value) : []));
  const ad = computed(() => ads.value[0] ?? null);

  return {
    ads,
    ad,
    enabled
  };
}
