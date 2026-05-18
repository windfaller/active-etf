import type { EtfInfo } from "../types.js";

export const cathayEtfs: EtfInfo[] = [
  {
    etfCode: "00400A",
    name: "主動國泰動能高息",
    issuer: "國泰投信",
    providerId: "cathay",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "EA",
    notes: "Official Cathay ETF XLSX endpoint uses FundCode=EA and SearchDate=YYYY-MM-DD."
  }
];
