import type { AdItem, AdSlotName, AdTrackingEvent } from "./types.js";
import { isAdTrackingRuntimeEnabled, isAdsRuntimeEnabled } from "./runtimeConfig.js";

export function isAdsFeatureEnabled(): boolean {
  return isAdsRuntimeEnabled();
}

export function buildAdTrackingEvent(input: {
  ad: AdItem;
  slot: AdSlotName;
  page?: string;
  etfCode?: string;
  timestamp?: Date;
}): AdTrackingEvent {
  return {
    adId: input.ad.id,
    provider: input.ad.provider,
    slot: input.slot,
    page: input.page ?? "/",
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    etfCode: input.etfCode
  };
}

async function postTrackingEvent(endpoint: string | undefined, event: AdTrackingEvent): Promise<void> {
  if (!endpoint || !isAdsFeatureEnabled() || !isAdTrackingRuntimeEnabled()) return;

  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event),
    keepalive: true
  }).catch(() => {
    // Tracking must never interrupt ETF content or navigation.
  });
}

export async function trackAdImpression(input: {
  ad: AdItem;
  slot: AdSlotName;
  page?: string;
  etfCode?: string;
}): Promise<void> {
  if (!input.ad.enabled) return;

  await postTrackingEvent(
    input.ad.tracking?.impression ?? "/api/ad/impression",
    buildAdTrackingEvent(input)
  );
}

export async function trackAdClick(input: {
  ad: AdItem;
  slot: AdSlotName;
  page?: string;
  etfCode?: string;
}): Promise<void> {
  if (!input.ad.enabled) return;

  await postTrackingEvent(input.ad.tracking?.click ?? "/api/ad/click", buildAdTrackingEvent(input));
}
