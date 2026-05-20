import type { AdItem } from "./types.js";

export const adRegistry: AdItem[] = [
  {
    id: "forvix-fed-2026-ratecuts",
    provider: "forvix",
    title: "市場預期：2026 聯準會不降息機率最高",
    description: "5/20 資料顯示，0 次降息機率約 69.5%。追蹤全球市場如何看待 Fed、通膨與風險事件。",
    imageUrl: "/assets/ads/forvix-fed-2026-ratecuts-visual-v3.png",
    link: "https://www.forvix.app/?topic=market&lang=zh-TW&tab=polymarket&id=51456",
    slots: ["article-inline", "sidebar-top"],
    enabled: true,
    priority: 100,
    weight: 100,
    tags: ["macro", "fed", "rates", "bond", "market-sentiment", "prediction-intelligence"],
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
    link: "https://forvix.example.com",
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
