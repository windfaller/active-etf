export type GlobalEtfSourceStatus = "verified" | "needs_endpoint_verification" | "blocked" | "unavailable";
export type GlobalEtfStrategyType = "active" | "index" | "covered_call" | "active_fixed_income" | "commodity" | "crypto" | "13f";
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
  | "macro"
  | "manufacturing"
  | "defense"
  | "healthcare"
  | "private_markets"
  | "13f";

export interface GlobalEtfConfig {
  etfCode: string;
  fundName: string;
  issuer: string;
  market: "US";
  currency: "USD";
  productGroup: "global_etf";
  providerId:
    | "roundhill"
    | "tema"
    | "blackrock"
    | "corgi"
    | "sec13f"
    | "ark"
    | "tuttle"
    | "janusHenderson"
    | "alger"
    | "allianceBernsteinUs"
    | "jpmorganUs"
    | "capitalGroup"
    | "amplify"
    | "tRowePrice"
    | "goldmanSachs"
    | "pimco"
    | "wedbush";
  strategyType: GlobalEtfStrategyType;
  enabled: boolean;
  sourceStatus: GlobalEtfSourceStatus;
  sourceUrl: string;
  holdingsUrl?: string;
  secCik?: string;
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
    etfCode: "WELD",
    fundName: "Tema U.S. Manufacturing & Reshoring ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/weld",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/WELD-holdings.csv",
    themes: ["manufacturing", "macro", "innovation"]
  },
  {
    etfCode: "HRTS",
    fundName: "Tema Heart & Health ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/hrts",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/HRTS-holdings.csv",
    themes: ["healthcare", "innovation"]
  },
  {
    etfCode: "CANC",
    fundName: "Tema Oncology ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/canc",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/CANC-holdings.csv",
    themes: ["healthcare", "genomics", "innovation"]
  },
  {
    etfCode: "TOLL",
    fundName: "Tema Durable Quality ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/toll",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/TOLL-holdings.csv",
    themes: ["macro"]
  },
  {
    etfCode: "VOLT",
    fundName: "Tema Electrification ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/volt",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/VOLT-holdings.csv",
    themes: ["innovation", "macro"]
  },
  {
    etfCode: "DSPY",
    fundName: "Tema S&P 500 Historical Weight ETF Strategy",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "index",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/dspy",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/DSPY-holdings.csv",
    themes: ["macro"]
  },
  {
    etfCode: "ARMY",
    fundName: "Tema International Defense ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/army",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/ARMY-holdings.csv",
    themes: ["defense", "macro", "ai"]
  },
  {
    etfCode: "PRVT",
    fundName: "Tema Listed Private Managers ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/prvt",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/AAUM-holdings.csv",
    themes: ["private_markets", "macro"]
  },
  {
    etfCode: "DISK",
    fundName: "Tema Memory ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/disk",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/DISK-holdings.csv",
    themes: ["semiconductor", "memory", "ai"]
  },
  {
    etfCode: "LAZR",
    fundName: "Tema Photonics & Optical ETF",
    issuer: "Tema ETFs",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tema",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://temaetfs.com/lazr",
    holdingsUrl: "https://temaetfs.com/hubfs/Website/Holdings/LAZR-holdings.csv",
    themes: ["semiconductor", "ai", "innovation"]
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
    etfCode: "HBMX",
    fundName: "Tuttle Capital Concentrated Memory Stack ETF",
    issuer: "Tuttle Capital",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "tuttle",
    strategyType: "active",
    enabled: true,
    sourceStatus: "needs_endpoint_verification",
    sourceUrl: "https://www.tuttlecap.com/",
    themes: ["semiconductor", "memory", "ai"],
    notes: "Nasdaq confirms HBMX as an ETF; official daily holdings endpoint still needs verification before sync is enabled."
  },
  {
    etfCode: "JHAI",
    fundName: "Janus Henderson Global Artificial Intelligence ETF",
    issuer: "Janus Henderson",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "janusHenderson",
    strategyType: "active",
    enabled: true,
    sourceStatus: "needs_endpoint_verification",
    sourceUrl: "https://www.janushenderson.com/",
    themes: ["ai", "semiconductor", "innovation"],
    notes: "Nasdaq confirms JHAI as an ETF; official daily holdings endpoint still needs verification before sync is enabled."
  },
  {
    etfCode: "ALAI",
    fundName: "Alger AI Enablers & Adopters ETF",
    issuer: "Alger",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "alger",
    strategyType: "active",
    enabled: true,
    sourceStatus: "needs_endpoint_verification",
    sourceUrl: "https://www.alger.com/",
    themes: ["ai", "semiconductor", "innovation"],
    notes: "Nasdaq confirms ALAI as an ETF; official daily holdings endpoint still needs verification before sync is enabled."
  },
  {
    etfCode: "FWD",
    fundName: "AB Disruptors ETF",
    issuer: "AllianceBernstein",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "allianceBernsteinUs",
    strategyType: "active",
    enabled: true,
    sourceStatus: "needs_endpoint_verification",
    sourceUrl: "https://www.alliancebernstein.com/",
    themes: ["ai", "innovation", "macro"],
    notes: "Nasdaq confirms FWD as an ETF; official daily holdings endpoint still needs verification before sync is enabled."
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
  },
  {
    etfCode: "DYNF",
    fundName: "iShares U.S. Equity Factor Rotation Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/307283/ishares-u-s-equity-factor-rotation-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=307283&component=fundDownload&userType=individual",
    themes: ["macro", "innovation"]
  },
  {
    etfCode: "BINC",
    fundName: "iShares Flexible Income Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active_fixed_income",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/331752/ishares-flexible-income-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=331752&component=fundDownload&userType=individual",
    themes: ["income", "macro"]
  },
  {
    etfCode: "ICSH",
    fundName: "iShares Ultra Short Duration Bond Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active_fixed_income",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/258806/ishares-liquidity-income-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=258806&component=fundDownload&userType=individual",
    themes: ["income", "macro"]
  },
  {
    etfCode: "BALI",
    fundName: "iShares U.S. Large Cap Premium Income Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "covered_call",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/333207/ishares-u-s-large-cap-premium-income-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=333207&component=fundDownload&userType=individual",
    themes: ["income", "macro"]
  },
  {
    etfCode: "CLOA",
    fundName: "iShares AAA CLO Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active_fixed_income",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/330488/ishares-aaa-clo-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=330488&component=fundDownload&userType=individual",
    themes: ["income", "macro"]
  },
  {
    etfCode: "ARK13F",
    fundName: "ARK Investment Management 13F Portfolio",
    issuer: "ARK Investment Management",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "sec13f",
    strategyType: "13f",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=1697748",
    holdingsUrl: "https://data.sec.gov/submissions/CIK0001697748.json",
    secCik: "0001697748",
    themes: ["13f", "innovation", "ai"]
  },
  {
    etfCode: "BRK13F",
    fundName: "Berkshire Hathaway 13F Portfolio",
    issuer: "Berkshire Hathaway",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "sec13f",
    strategyType: "13f",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=1067983",
    holdingsUrl: "https://data.sec.gov/submissions/CIK0001067983.json",
    secCik: "0001067983",
    themes: ["13f", "macro"]
  },
  {
    etfCode: "PSQ13F",
    fundName: "Pershing Square Capital Management 13F Portfolio",
    issuer: "Pershing Square Capital Management",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "sec13f",
    strategyType: "13f",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=1336528",
    holdingsUrl: "https://data.sec.gov/submissions/CIK0001336528.json",
    secCik: "0001336528",
    themes: ["13f", "macro"]
  },
  {
    etfCode: "APP13F",
    fundName: "Appaloosa LP 13F Portfolio",
    issuer: "Appaloosa LP",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "sec13f",
    strategyType: "13f",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=1656456",
    holdingsUrl: "https://data.sec.gov/submissions/CIK0001656456.json",
    secCik: "0001656456",
    themes: ["13f", "macro", "ai"]
  },
  {
    etfCode: "IDEF",
    fundName: "iShares Defense Industrials Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/343529/ishares-defense-industrials-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=343529&component=fundDownload&userType=individual",
    themes: ["macro", "ai"]
  },
  {
    etfCode: "BDYN",
    fundName: "iShares Dynamic Equity Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/345325/ishares-dynamic-equity-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=345325&component=fundDownload&userType=individual",
    themes: ["macro", "innovation"]
  },
  {
    etfCode: "IALT",
    fundName: "iShares Systematic Alternatives Active ETF",
    issuer: "iShares",
    market: "US",
    currency: "USD",
    productGroup: "global_etf",
    providerId: "blackrock",
    strategyType: "active",
    enabled: true,
    sourceStatus: "verified",
    sourceUrl: "https://www.ishares.com/us/products/346898/ishares-systematic-alternatives-active-etf",
    holdingsUrl:
      "https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ISHARES&targetSite=us-ishares&locale=en_US&portfolioId=346898&component=fundDownload&userType=individual",
    themes: ["macro"]
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
    ["IVES", "Dan IVES Wedbush AI Revolution ETF", "Wedbush", "wedbush", "index", ["ai", "innovation"]],
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
    ["BOND", "PIMCO Active Bond ETF", "PIMCO", "pimco", "active_fixed_income", ["income", "macro"]]
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
