import type { EtfInfo } from "../types.js";

export const fhEtfs: EtfInfo[] = [
  {
    etfCode: "00991A",
    fundCode: "ETF23",
    name: "主動復華未來50",
    issuer: "復華投信",
    providerId: "fh",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    notes: "Official Fuh Hwa JSON endpoints: /api/assets and /api/ETFPcf"
  },
  {
    etfCode: "00409A",
    fundCode: "ETF26",
    name: "主動復華全球50",
    issuer: "復華投信",
    providerId: "fh",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    notes: "Official Fuh Hwa JSON endpoints: /api/assets and /api/ETFPcf; supports global equity tickers"
  }
];
