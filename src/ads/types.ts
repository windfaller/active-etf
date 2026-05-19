export type AdSlotName =
  | "hero-banner"
  | "sidebar-top"
  | "sidebar-bottom"
  | "article-inline"
  | "mobile-footer"
  | "telegram-card"
  | (string & {});

export type AdProvider = "forvix" | "h8" | (string & {});

export interface AdTrackingUrls {
  impression?: string;
  click?: string;
}

export interface AdItem {
  id: string;

  provider: AdProvider;

  title: string;
  description?: string;

  imageUrl?: string;

  link: string;

  slots: AdSlotName[];

  enabled: boolean;

  priority?: number;
  weight?: number;

  tags?: string[];

  startAt?: string;
  endAt?: string;

  tracking?: AdTrackingUrls;
}

export interface AdSelectionContext {
  slot: AdSlotName;
  now?: Date;
  tags?: string[];
  limit?: number;
  random?: () => number;
}

export type AdRenderMode = "card" | "compact" | "carousel" | "telegram";

export interface AdTrackingEvent {
  adId: string;
  slot: AdSlotName;
  page: string;
  timestamp: string;
  etfCode?: string;
  provider?: AdProvider;
}
