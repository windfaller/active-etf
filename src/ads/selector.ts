import type { AdItem, AdSelectionContext, AdSlotName } from "./types.js";

function toTimestamp(value?: string): number | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

export function isAdInDateRange(ad: AdItem, now = new Date()): boolean {
  const nowTime = now.getTime();
  const startTime = toTimestamp(ad.startAt);
  const endTime = toTimestamp(ad.endAt);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false;
  if (startTime !== null && nowTime < startTime) return false;
  if (endTime !== null && nowTime > endTime) return false;

  return true;
}

export function isAdEligibleForSlot(ad: AdItem, slot: AdSlotName, now = new Date(), tags: string[] = []): boolean {
  if (!ad.enabled) return false;
  if (!ad.slots.includes(slot)) return false;
  if (!isAdInDateRange(ad, now)) return false;
  if (tags.length && !tags.some((tag) => ad.tags?.includes(tag))) return false;

  return true;
}

export function getEligibleAds(ads: AdItem[], context: AdSelectionContext): AdItem[] {
  const now = context.now ?? new Date();
  const eligible = ads.filter((ad) => isAdEligibleForSlot(ad, context.slot, now, context.tags));

  return eligible.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function selectWeightedAd(ads: AdItem[], random: () => number = Math.random): AdItem | null {
  if (!ads.length) return null;

  const totalWeight = ads.reduce((sum, ad) => sum + Math.max(0, ad.weight ?? 1), 0);
  if (totalWeight <= 0) return ads[0] ?? null;

  let cursor = random() * totalWeight;
  for (const ad of ads) {
    cursor -= Math.max(0, ad.weight ?? 1);
    if (cursor <= 0) return ad;
  }

  return ads[ads.length - 1] ?? null;
}

export function selectAdForSlot(ads: AdItem[], context: AdSelectionContext): AdItem | null {
  const eligible = getEligibleAds(ads, context);
  if (!eligible.length) return null;

  const highestPriority = eligible[0]?.priority ?? 0;
  const priorityPool = eligible.filter((ad) => (ad.priority ?? 0) === highestPriority);
  return selectWeightedAd(priorityPool, context.random);
}

export function selectAdsForSlot(ads: AdItem[], context: AdSelectionContext): AdItem[] {
  const limit = context.limit ?? 1;
  if (limit <= 0) return [];

  const eligible = getEligibleAds(ads, context);
  const selected: AdItem[] = [];
  const remaining = [...eligible];

  while (selected.length < limit && remaining.length) {
    const highestPriority = remaining[0]?.priority ?? 0;
    const priorityPool = remaining.filter((ad) => (ad.priority ?? 0) === highestPriority);
    const selectedAd = selectWeightedAd(priorityPool, context.random);
    if (!selectedAd) break;

    selected.push(selectedAd);
    remaining.splice(remaining.indexOf(selectedAd), 1);
  }

  return selected;
}
