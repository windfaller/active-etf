import type { EtfInfo } from "../types.js";

export const fubonEtfs: EtfInfo[] = [
  {
    etfCode: "00982D",
    name: "主動富邦動態入息",
    issuer: "富邦投信",
    providerId: "fubon",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "00982D",
    notes:
      "Official Fubon assets page renders fixed-income holdings and summary server-side. Holdings rows use bond ISIN or ETF ticker as stockId for the shared schema."
  },
  {
    etfCode: "00983D",
    name: "主動富邦複合收益",
    issuer: "富邦投信",
    providerId: "fubon",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "00983D",
    notes:
      "Official Fubon assets page renders fixed-income holdings and summary server-side. Holdings rows use bond ISIN or ETF ticker as stockId for the shared schema."
  }
];
