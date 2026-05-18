import type { EtfInfo } from "../types.js";

export const ctbcEtfs: EtfInfo[] = [
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
  }
];
