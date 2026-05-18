import type { EtfInfo } from "../types.js";

export const taishinEtfs: EtfInfo[] = [
  {
    etfCode: "00986A",
    name: "台新台股優勢成長主動式ETF",
    issuer: "台新投信",
    providerId: "taishin",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "00986A",
    notes: "Official Taishin PCF page renders complete server-side holdings and PCF summary HTML."
  },
  {
    etfCode: "00987A",
    name: "台新主動式台股ETF",
    issuer: "台新投信",
    providerId: "taishin",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "00987A",
    notes: "Official Taishin PCF page renders complete server-side holdings and PCF summary HTML."
  }
];
