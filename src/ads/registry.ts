import type { AdItem } from "./types.js";

export const adRegistry: AdItem[] = [
  {
    id: "forvix-fed-july-decision",
    provider: "forvix",
    title: "7月聯準會利率決策會如何？",
    description: "交易前先看群眾預測，做出更明智的決策。",
    imageUrl: "/assets/ads/forvix-fed-july-decision-v1.webp",
    imageOnly: true,
    link: "https://www.forvix.app/?id=287395",
    slots: ["article-inline", "sidebar-top"],
    enabled: true,
    priority: 100,
    weight: 100,
    tags: ["macro", "fed", "rates", "fomc", "market-sentiment", "crowd-intelligence"],
    tracking: {
      impression: "/api/ad/impression",
      click: "/api/ad/click"
    }
  },
  {
    id: "forvix-prediction-intelligence-v1",
    provider: "forvix",
    title: "Forecast the World",
    description: "Prediction intelligence for macro, geopolitical, and market-moving events.",
    link: "https://www.forvix.app",
    slots: ["hero-banner", "sidebar-top", "article-inline", "telegram-card"],
    enabled: false,
    priority: 80,
    weight: 10,
    tags: ["prediction-intelligence", "event-markets", "macro", "fintech", "dark-ui"],
    tracking: {
      impression: "/api/ad/impression",
      click: "/api/ad/click"
    }
  },
  {
    id: "h8-rewards-hub-v1",
    provider: "h8",
    title: "Daily Rewards Hub",
    description: "A premium activity and rewards experience for daily fintech engagement.",
    link: "https://h8.example.com",
    slots: ["sidebar-bottom", "mobile-footer", "telegram-card"],
    enabled: false,
    priority: 60,
    weight: 8,
    tags: ["rewards", "activity-hub", "membership", "lifestyle-fintech"],
    tracking: {
      impression: "/api/ad/impression",
      click: "/api/ad/click"
    }
  }
];

export function getRegisteredAds(): AdItem[] {
  return adRegistry;
}
