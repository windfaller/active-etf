import type { EtfInfo } from "../types.js";

export const uniPresidentEtfs: EtfInfo[] = [
  {
    etfCode: "00981A",
    fundCode: "49YTW",
    name: "主動統一台股增長",
    issuer: "統一投信",
    providerId: "uniPresident",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified"
  },
  {
    etfCode: "00403A",
    fundCode: "63YTW",
    name: "主動統一升級50",
    issuer: "統一投信",
    providerId: "uniPresident",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified"
  },
  {
    etfCode: "00988A",
    fundCode: "61YTW",
    name: "主動統一全球創新",
    issuer: "統一投信",
    providerId: "uniPresident",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    notes: "Existing tracked ETF; not part of the user's new first-stage list but kept to avoid removing current functionality."
  }
];
