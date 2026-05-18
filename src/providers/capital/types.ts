import type { EtfInfo } from "../types.js";

export const capitalEtfs: EtfInfo[] = [
  {
    etfCode: "00997A",
    name: "群益美國增長主動式ETF",
    issuer: "群益投信",
    providerId: "capital",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "502",
    notes: "Official CFWeb /api/etf/buyback endpoint, fundId 502"
  },
  {
    etfCode: "00982A",
    name: "群益台灣強棒主動式ETF",
    issuer: "群益投信",
    providerId: "capital",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "399",
    notes: "Official CFWeb /api/etf/buyback endpoint, fundId 399"
  },
  {
    etfCode: "00992A",
    name: "群益台灣科技創新主動式ETF",
    issuer: "群益投信",
    providerId: "capital",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "500",
    notes: "Official CFWeb /api/etf/buyback endpoint, fundId 500"
  }
];
