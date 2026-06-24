export type GlobalEtfSourceStatus = "verified" | "needs_endpoint_verification" | "blocked" | "unavailable";
export type GlobalEtfStrategyType = "active" | "index" | "covered_call" | "active_fixed_income" | "commodity" | "crypto";
export type GlobalEtfTheme =
  | "ai"
  | "semiconductor"
  | "space"
  | "memory"
  | "innovation"
  | "internet"
  | "genomics"
  | "robotics"
  | "fintech"
  | "income"
  | "macro";

export interface GlobalEtfConfig {
  etfCode: string;
  fundName: string;
  issuer: string;
  market: "US";
  currency: "USD";
  productGroup: "global_etf";
  providerId: "roundhill" | "tema" | "blackrock" | "corgi" | "ark" | "jpmorganUs" | "capitalGroup" | "amplify" | "tRowePrice" | "goldmanSachs" | "pimco";
  strategyType: GlobalEtfStrategyType;
  enabled: boolean;
  sourceStatus: GlobalEtfSourceStatus;
  sourceUrl: string;
  holdingsUrl?: string;
  themes: GlobalEtfTheme[];
  notes?: string;
}

export const enabledGlobalEtfs: GlobalEtfConfig[] = [
  {
    etfCode: "DRAM",
    fundName: "Roundhill Memory ETF",
    issuer: "Roundhill Investments",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "roundhill",
    strategyType: "index",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.roundhillinvestments.com/etf/dram/",
    themes: ["semiconductor", "memory", "ai"]
  },
  {
    etfCode: "NASA",
    fundName: "Tema Space Innovators ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/nasa",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/NASA-holdings.csv",
    themes: ["space", "innovation", "macro"]
  },
  {
    etfCode: "BAI",
    fundName: "iShares A.I. Innovation and Tech Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/339081/ishares-a-i-innovation-and-tech-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=339081&component=fundDownload&userType=individual",
    themes: ["ai", "semiconductor", "innovation"]
  },
  {
    etfCode: "EUV",
    fundName: "Corgi Lithography & Semiconductor Photonics ETF",
    issuer: "Corgi Funds",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "corgi",
    strategyType: "index",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://corgifunds.com/euv",
    holdingsUrl: "https://cmltk98h4m.execute-api.us-east-2.amazonaws.com/api/v1/holdings?account=EUV&limit=1000",
    themes: ["semiconductor", "ai"]
  }
];

export const globalEtfCandidates: GlobalEtfConfig[] = [
  ...enabledGlobalEtfs,
  ...[
    ["ARKK", "ARK Innovation ETF", "ARK Invest", "ark", "active", ["innovation", "ai"]],
    ["ARKW", "ARK Next Generation Internet ETF", "ARK Invest", "ark", "active", ["internet", "innovation"]],
    ["ARKG", "ARK Genomic Revolution ETF", "ARK Invest", "ark", "active", ["genomics", "innovation"]],
    ["ARKQ", "ARK Autonomous Technology & Robotics ETF", "ARK Invest", "ark", "active", ["robotics", "ai"]],
    ["ARKF", "ARK Fintech Innovation ETF", "ARK Invest", "ark", "active", ["fintech", "innovation"]],
    ["ARKX", "ARK Space Exploration & Innovation ETF", "ARK Invest", "ark", "active", ["space", "innovation"]],
    ["JEPI", "JPMorgan Equity Premium Income ETF", "JPMorgan", "jpmorganUs", "covered_call", ["income", "macro"]],
    ["JEPQ", "JPMorgan Nasdaq Equity Premium Income ETF", "JPMorgan", "jpmorganUs", "covered_call", ["income", "ai"]],
    ["CGGR", "Capital Group Growth ETF", "Capital Group", "capitalGroup", "active", ["innovation", "macro"]],
    ["CGDV", "Capital Group Dividend Value ETF", "Capital Group", "capitalGroup", "active", ["income", "macro"]],
    ["CGUS", "Capital Group Core Equity ETF", "Capital Group", "capitalGroup", "active", ["macro"]],
    ["DIVO", "Amplify CWP Enhanced Dividend Income ETF", "Amplify", "amplify", "covered_call", ["income"]],
    ["TCAF", "T. Rowe Price Capital Appreciation Equity ETF", "T. Rowe Price", "tRowePrice", "active", ["macro"]],
    ["GPIX", "Goldman Sachs S&P 500 Core Premium Income ETF", "Goldman Sachs", "goldmanSachs", "covered_call", ["income", "macro"]],
    ["GPIQ", "Goldman Sachs Nasdaq-100 Core Premium Income ETF", "Goldman Sachs", "goldmanSachs", "covered_call", ["income", "ai"]],
    ["JPST", "JPMorgan Ultra-Short Income ETF", "JPMorgan", "jpmorganUs", "active_fixed_income", ["income", "macro"]],
    ["MINT", "PIMCO Enhanced Short Maturity Active ETF", "PIMCO", "pimco", "active_fixed_income", ["income", "macro"]],
    ["BOND", "PIMCO Active Bond ETF", "PIMCO", "pimco", "active_fixed_income", ["income", "macro"]],
    ["ICSH", "iShares Ultra Short-Term Bond Active ETF", "iShares", "blackrock", "active_fixed_income", ["income", "macro"]]
  ].map(([etfCode, fundName, issuer, providerId, strategyType, themes]) => ({
    etfCode: etfCode as string,
    fundName: fundName as string,
    issuer: issuer as string,
    market: "US" as const,
    currency: "USD" as const,
    productGroup: "global_etf" as const,
    providerId: providerId as GlobalEtfConfig["providerId"],
    strategyType: strategyType as GlobalEtfStrategyType,
    enabled: false,
    sourceStatus: "needs_endpoint_verification" as const,
    sourceUrl: "",
    themes: themes as GlobalEtfTheme[],
    notes: "Official issuer holdings endpoint must be verified before enabling."
  }))
];

export function findGlobalEtfConfig(etfCode: string): GlobalEtfConfig | undefined {
  const normalized = etfCode.trim().toUpperCase();
  return globalEtfCandidates.find((etf) => etf.etfCode === normalized);
}
