export interface SearchResult {
  type: "tw_etf" | "global_etf" | "institution" | "tw_stock" | "us_stock" | "sector" | "signal";
  typeLabel: string;
  code: string;
  name: string;
  market: string;
  latestDataDate: string | null;
  path: string;
}

export interface SearchResponse {
  generatedAt: string;
  query: string;
  results: SearchResult[];
}
