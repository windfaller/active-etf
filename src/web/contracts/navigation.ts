export type AppView =
  | "daily"
  | "market"
  | "taiwanEtf"
  | "globalMarket"
  | "globalEtf"
  | "institutions"
  | "institution"
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
}
