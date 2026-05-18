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
  },
  {
    etfCode: "00980A",
    fundCode: "00980A",
    name: "主動野村臺灣優選",
    issuer: "野村投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "nomura",
      infoUrl: "https://www.nomurafunds.com.tw/ETFWEB/product-description?fundNo=00980A"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00985A",
    fundCode: "00985A",
    name: "野村臺灣50主動式ETF",
    issuer: "野村投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "nomura",
      infoUrl: "https://www.nomurafunds.com.tw/ETFWEB/product-description?fundNo=00985A"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00999A",
    fundCode: "00999A",
    name: "野村全球航運龍頭主動式ETF",
    issuer: "野村投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "nomura",
      infoUrl: "https://www.nomurafunds.com.tw/ETFWEB/product-description?fundNo=00999A"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00982A",
    fundCode: "399",
    name: "主動群益台灣強棒",
    issuer: "群益投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "capital",
      infoUrl: "https://www.capitalfund.com.tw/etf/product/detail/399/basic",
      pcfUrl: "https://www.capitalfund.com.tw/etf/product/detail/399/buyback"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00992A",
    fundCode: "500",
    name: "主動群益科技創新",
    issuer: "群益投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "capital",
      infoUrl: "https://www.capitalfund.com.tw/etf/product/detail/500/basic",
      pcfUrl: "https://www.capitalfund.com.tw/etf/product/detail/500/buyback"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00990A",
    fundCode: "00990A",
    name: "主動元大AI新經濟",
    issuer: "元大投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "yuanta",
      infoUrl: "https://www.yuantaetfs.com/product/detail/00990A",
      pcfUrl: "https://www.yuantaetfs.com/tradeInfo/pcf/00990A"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00983A",
    fundCode: "E0034",
    name: "主動中信ARK創新",
    issuer: "中信投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "ctbc",
      infoUrl: "https://www.ctbcinvestments.com.tw/ETF/00983A/Info",
      pcfUrl: "https://www.ctbcinvestments.com.tw/ETF/Buyback"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00986A",
    fundCode: "00986A",
    name: "主動台新龍頭成長",
    issuer: "台新投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "taishin",
      infoUrl: "https://www.tsit.com.tw/ETF/Home/ETFSeriesDetail/00986A",
      pcfUrl: "https://www.tsit.com.tw/ETF/Home/Pcf/00986A"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00987A",
    fundCode: "00987A",
    name: "主動台新優勢成長",
    issuer: "台新投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "taishin",
      infoUrl: "https://www.tsit.com.tw/ETF/Home/ETFSeriesDetail/00987A",
      pcfUrl: "https://www.tsit.com.tw/ETF/Home/Pcf/00987A"
    },
    createdAt: now,
    updatedAt: now
  }
];

export function getConfiguredEtf(etfCode: string): EtfMaster | undefined {
  return configuredEtfs.find((etf) => etf.etfCode.toUpperCase() === etfCode.toUpperCase());
}
