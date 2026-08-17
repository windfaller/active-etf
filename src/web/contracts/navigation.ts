export type AppView =
  | "daily"
  | "market"
  | "taiwanEtf"
  | "globalMarket"
  | "globalEtf"
  | "institutions"
  | "institution"
  | "stocks"
  | "stock"
  | "compareEtfs"
  | "performance"
  | "signals"
  | "etfStyle"
  | "search"
  | "methodology"
  | "notFound";

export type TaiwanEtfPage = "report" | "premiumHistory";
export type TaiwanEtfSection = "overview" | "changes";

export interface AppRoute {
  view: AppView;
  path: string;
  etfCode?: string;
  etfPage?: TaiwanEtfPage;
  etfSection?: TaiwanEtfSection;
  globalCode?: string;
  institutionCode?: string;
  stockMarket?: "tw" | "us";
  stockSymbol?: string;
  compareType?: "tw" | "global";
  compareCodes?: string[];
  signalKind?: "all" | "consecutive" | "reversals" | "divergence";
  searchQuery?: string;
}
