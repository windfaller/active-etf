import type { EtfMaster } from "../models/EtfMaster.js";

const now = new Date("2026-05-17T00:00:00.000Z");

export const configuredEtfs: EtfMaster[] = [
  {
    etfCode: "00981A",
    fundCode: "49YTW",
    name: "主動統一台股增長",
    issuer: "統一投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      infoUrl: "https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=49YTW",
      pcfUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=49YTW",
      unitMarketRatioUrl: "https://www.ezmoney.com.tw/ETF/Transaction/UnitMarketRatio?fundCode=49YTW"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00988A",
    fundCode: "61YTW",
    name: "主動統一全球創新",
    issuer: "統一投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      infoUrl: "https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=61YTW",
      pcfUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=61YTW",
      unitMarketRatioUrl: "https://www.ezmoney.com.tw/ETF/Transaction/UnitMarketRatio?fundCode=61YTW"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00403A",
    fundCode: "63YTW",
    name: "主動統一升級50",
    issuer: "統一投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      infoUrl: "https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=63YTW",
      pcfUrl: "https://www.ezmoney.com.tw/ETF/Transaction/PCF?fundCode=63YTW",
      unitMarketRatioUrl: "https://www.ezmoney.com.tw/ETF/Transaction/UnitMarketRatio?fundCode=63YTW"
    },
    createdAt: now,
    updatedAt: now
  }
];

export function getConfiguredEtf(etfCode: string): EtfMaster | undefined {
  return configuredEtfs.find((etf) => etf.etfCode.toUpperCase() === etfCode.toUpperCase());
}
