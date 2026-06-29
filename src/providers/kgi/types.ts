import type { EtfInfo } from "../types.js";

export const kgiEtfs: EtfInfo[] = [
  {
    etfCode: "00407A",
    name: "主動凱基台灣",
    issuer: "凱基投信",
    providerId: "kgi",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "J024",
    notes:
      "Official KGI RedemptionVC endpoint renders complete server-side PCF summary and stock holdings HTML for fundID=J024."
  }
];
