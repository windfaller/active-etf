import type { EtfInfo } from "../types.js";

export const allianceBernsteinEtfs: EtfInfo[] = [
  {
    etfCode: "00984D",
    name: "主動聯博全球非投",
    issuer: "聯博投信",
    providerId: "allianceBernstein",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "TW00000984D0",
    notes:
      "Official AllianceBernstein React page calls webapi holdings and basket JSON endpoints. Holdings rows use bond ISINs, futures names or generated row IDs in the shared schema."
  }
];
