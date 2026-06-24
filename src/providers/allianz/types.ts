import type { EtfInfo } from "../types.js";

export const allianzEtfs: EtfInfo[] = [
  {
    etfCode: "00984A",
    name: "主動安聯台灣高息",
    issuer: "安聯投信",
    providerId: "allianz",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "E0001",
    notes: "Official Allianz ETF GetFundTradeInfo endpoint, FundNo E0001"
  },
  {
    etfCode: "00993A",
    name: "主動安聯台灣",
    issuer: "安聯投信",
    providerId: "allianz",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "E0002",
    notes: "Official Allianz ETF GetFundTradeInfo endpoint, FundNo E0002"
  },
  {
    etfCode: "00402A",
    name: "主動安聯美國科技",
    issuer: "安聯投信",
    providerId: "allianz",
    currency: "TWD",
    enabled: true,
    implementationStatus: "verified",
    fundCode: "E0003",
    notes: "Official Allianz ETF GetFundTradeInfo endpoint, FundNo E0003"
  }
];
