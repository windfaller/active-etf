import type { EtfInfo } from "../types.js";

export const jpmorganEtfs: EtfInfo[] = [
  {
    etfCode: "00989A",
    name: "主動摩根美國科技",
    issuer: "摩根投信",
    providerId: "jpmorgan",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "TW00000989A5",
    notes: "Official J.P. Morgan ETF PCF XLSX supplement"
  },
  {
    etfCode: "00401A",
    name: "主動摩根台灣鑫收益",
    issuer: "摩根投信",
    providerId: "jpmorgan",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "TW00000401A1",
    notes: "Official J.P. Morgan ETF PCF XLSX supplement"
  }
];
