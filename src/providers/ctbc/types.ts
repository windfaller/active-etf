import type { EtfInfo } from "../types.js";

export const ctbcEtfs: EtfInfo[] = [
  {
    etfCode: "00995A",
    name: "主動中信台灣卓越",
    issuer: "中信投信",
    providerId: "ctbc",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "E0036",
    notes: "Official CTBC ETFCNOList maps 00995A to FID E0036; Buyback endpoint verified."
  },
  {
    etfCode: "00983A",
    name: "主動中信ARK創新",
    issuer: "中信投信",
    providerId: "ctbc",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "E0034",
    notes: "Official CTBC SPA calls home/AuthToken then etf/Buyback with this FID."
  },
  {
    etfCode: "00406A",
    name: "主動中信台灣收益",
    issuer: "中信投信",
    providerId: "ctbc",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "E0038",
    notes: "Official CTBC ETFCNOList maps 00406A to FID E0038; Buyback endpoint verified."
  }
];
