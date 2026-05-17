import type { EtfInfo } from "../types.js";

export const nomuraEtfs: EtfInfo[] = [
  {
    etfCode: "00980A",
    name: "野村台灣智慧優選主動式ETF",
    issuer: "野村投信",
    providerId: "nomura",
    currency: "TWD",
    enabled: false,
    implementationStatus: "verified",
    notes: "Official ETFWEB Fund/GetFundAssets JSON endpoint is verified; production sync wiring is intentionally pending."
  },
  {
    etfCode: "00985A",
    name: "野村台灣50主動式ETF",
    issuer: "野村投信",
    providerId: "nomura",
    currency: "TWD",
    enabled: false,
    implementationStatus: "verified",
    notes: "Official ETFWEB Fund/GetFundAssets JSON endpoint is verified; production sync wiring is intentionally pending."
  },
  {
    etfCode: "00999A",
    name: "野村全球航運龍頭主動式ETF",
    issuer: "野村投信",
    providerId: "nomura",
    currency: "TWD",
    enabled: false,
    implementationStatus: "verified",
    notes: "Official ETFWEB Fund/GetFundAssets JSON endpoint is verified; production sync wiring is intentionally pending."
  }
];
