import { describe, expect, it } from "vitest";
import {
  getEligibleAds,
  isAdInDateRange,
  selectAdForSlot,
  selectAdsForSlot
} from "../../src/ads/selector.js";
import type { AdItem } from "../../src/ads/types.js";

function ad(input: Partial<AdItem> & Pick<AdItem, "id" | "slots">): AdItem {
  return {
    id: input.id,
    provider: input.provider ?? "forvix",
    title: input.title ?? input.id,
    link: input.link ?? "https://example.com",
    slots: input.slots,
    enabled: input.enabled ?? true,
    priority: input.priority,
    weight: input.weight,
    tags: input.tags,
    startAt: input.startAt,
    endAt: input.endAt,
    tracking: input.tracking
  };
}

describe("ad selector", () => {
  const now = new Date("2026-05-19T08:00:00.000Z");

  it("filters by enabled status, slot, and date range", () => {
    const ads = [
      ad({ id: "enabled-current", slots: ["sidebar-top"], startAt: "2026-05-01", endAt: "2026-05-31" }),
      ad({ id: "disabled", slots: ["sidebar-top"], enabled: false }),
      ad({ id: "wrong-slot", slots: ["hero-banner"] }),
      ad({ id: "future", slots: ["sidebar-top"], startAt: "2026-06-01" }),
      ad({ id: "expired", slots: ["sidebar-top"], endAt: "2026-05-01" })
    ];

    expect(getEligibleAds(ads, { slot: "sidebar-top", now }).map((item) => item.id)).toEqual(["enabled-current"]);
  });

  it("treats invalid dates as ineligible", () => {
    expect(isAdInDateRange(ad({ id: "bad-date", slots: ["sidebar-top"], startAt: "not-a-date" }), now)).toBe(false);
  });

  it("selects within the highest priority pool before using weights", () => {
    const ads = [
      ad({ id: "low", slots: ["sidebar-top"], priority: 1, weight: 100 }),
      ad({ id: "high-a", slots: ["sidebar-top"], priority: 10, weight: 1 }),
      ad({ id: "high-b", slots: ["sidebar-top"], priority: 10, weight: 1 })
    ];

    const selected = selectAdForSlot(ads, { slot: "sidebar-top", now, random: () => 0.75 });

    expect(selected?.id).toBe("high-b");
  });

  it("returns a weighted multi-ad selection without duplicates", () => {
    const ads = [
      ad({ id: "a", slots: ["telegram-card"], priority: 5, weight: 1 }),
      ad({ id: "b", slots: ["telegram-card"], priority: 5, weight: 4 }),
      ad({ id: "c", slots: ["telegram-card"], priority: 4, weight: 10 })
    ];

    const selected = selectAdsForSlot(ads, { slot: "telegram-card", now, limit: 2, random: () => 0.99 });

    expect(selected.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
