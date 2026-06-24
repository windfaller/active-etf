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
    name: "主動野村臺灣高息",
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
    etfCode: "00997A",
    fundCode: "502",
    name: "主動群益美國增長",
    issuer: "群益投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "capital",
      infoUrl: "https://www.capitalfund.com.tw/etf/product/detail/502/basic",
      pcfUrl: "https://www.capitalfund.com.tw/etf/product/detail/502/buyback"
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
    etfCode: "00995A",
    fundCode: "E0036",
    name: "主動中信台灣卓越",
    issuer: "中信投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "ctbc",
      infoUrl: "https://www.ctbcinvestments.com.tw/ETF/00995A/Info",
      pcfUrl: "https://www.ctbcinvestments.com.tw/ETF/Buyback"
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
    etfCode: "00406A",
    fundCode: "E0038",
    name: "主動中信台灣收益",
    issuer: "中信投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "ctbc",
      infoUrl: "https://www.ctbcinvestments.com.tw/ETF/00406A/Info",
      pcfUrl: "https://www.ctbcinvestments.com.tw/ETF/Buyback"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00405A",
    fundCode: "00405A",
    name: "主動富邦台灣龍耀",
    issuer: "富邦投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "fubon",
      infoUrl: "https://www.fubon.com/asset-management/ph/activeequity/index.html",
      pcfUrl: "https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?stkId=00405A"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00982D",
    fundCode: "00982D",
    name: "主動富邦動態入息",
    issuer: "富邦投信",
    type: "active_etf",
    currency: "TWD",
    enabled: false,
    source: {
      providerId: "fubon",
      infoUrl: "https://www.fubon.com/asset-management/ph/activebond/index.html",
      pcfUrl: "https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?stkId=00982D"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00983D",
    fundCode: "00983D",
    name: "主動富邦複合收益",
    issuer: "富邦投信",
    type: "active_etf",
    currency: "TWD",
    enabled: false,
    source: {
      providerId: "fubon",
      infoUrl: "https://www.fubon.com/asset-management/ph/activebond/index.html",
      pcfUrl: "https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?stkId=00983D"
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
  },
  {
    etfCode: "00400A",
    fundCode: "EA",
    name: "主動國泰動能高息",
    issuer: "國泰投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "cathay",
      infoUrl: "https://www.cathaysite.com.tw/fund-details/EEA",
      pcfUrl: "https://cwapi.cathaysite.com.tw/api/ETF/DownloadETFWeightExcel?FundCode=EA"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00984A",
    fundCode: "E0001",
    name: "主動安聯台灣高息",
    issuer: "安聯投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "allianz",
      infoUrl: "https://etf.allianzgi.com.tw/etf-info/E0001",
      pcfUrl: "https://etf.allianzgi.com.tw/list-trade"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00402A",
    fundCode: "E0003",
    name: "主動安聯美國科技",
    issuer: "安聯投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "allianz",
      infoUrl: "https://etf.allianzgi.com.tw/etf-info/E0003",
      pcfUrl: "https://etf.allianzgi.com.tw/list-trade"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00404A",
    fundCode: "TW00000404A5",
    name: "主動聯博動能50",
    issuer: "聯博投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "allianceBernstein",
      infoUrl: "https://www.abfunds.com.tw/zh-tw/etfs/pcf.TW00000404A5.html",
      pcfUrl: "https://www.abfunds.com.tw/zh-tw/etfs/pcf.TW00000404A5.html"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00984D",
    fundCode: "TW00000984D0",
    name: "主動聯博全球非投",
    issuer: "聯博投信",
    type: "active_etf",
    currency: "TWD",
    enabled: false,
    source: {
      providerId: "allianceBernstein",
      infoUrl:
        "https://www.abfunds.com.tw/zh-tw/funds/etf/active/fixed-income/abitl-select-global-high-yield-active-etf.-.TW00000984D0.html",
      pcfUrl: "https://www.abfunds.com.tw/zh-tw/etfs/pcf.TW00000984D0.html"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00993A",
    fundCode: "E0002",
    name: "主動安聯台灣",
    issuer: "安聯投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "allianz",
      infoUrl: "https://etf.allianzgi.com.tw/etf-info/E0002",
      pcfUrl: "https://etf.allianzgi.com.tw/list-trade"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00996A",
    fundCode: "23",
    name: "兆豐台灣豐收主動式ETF",
    issuer: "兆豐投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "mega",
      infoUrl: "https://www.megafunds.com.tw/MEGA/etf/etf_product.aspx?id=23",
      pcfUrl: "https://www.megafunds.com.tw/MEGA/etf/trade_pcf.aspx"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00989A",
    fundCode: "TW00000989A5",
    name: "主動摩根美國科技",
    issuer: "摩根投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "jpmorgan",
      infoUrl:
        "https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-us-tech-leaders-active-etf-TW00000989A5",
      pcfUrl:
        "https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00989A_TW00000989A5.xlsx"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00401A",
    fundCode: "TW00000401A1",
    name: "主動摩根台灣鑫收益",
    issuer: "摩根投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "jpmorgan",
      infoUrl:
        "https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-taiwan-equity-high-income-active-etf-TW00000401A1",
      pcfUrl:
        "https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00401A_TW00000401A1.xlsx"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00991A",
    fundCode: "ETF23",
    name: "主動復華未來50",
    issuer: "復華投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "fh",
      infoUrl: "https://www.fhtrust.com.tw/ETF/etf_detail/ETF23",
      pcfUrl: "https://www.fhtrust.com.tw/api/assets?fundID=ETF23"
    },
    createdAt: now,
    updatedAt: now
  },
  {
    etfCode: "00994A",
    fundCode: "182",
    name: "主動第一金台股優",
    issuer: "第一金投信",
    type: "active_etf",
    currency: "TWD",
    enabled: true,
    source: {
      providerId: "first",
      infoUrl: "https://www.fsitc.com.tw/FundDetail.aspx?ID=182",
      pcfUrl: "https://www.fsitc.com.tw/WebAPI.aspx/Get_hd"
    },
    createdAt: now,
    updatedAt: now
  }
];

export function getConfiguredEtf(etfCode: string): EtfMaster | undefined {
  return configuredEtfs.find((etf) => etf.etfCode.toUpperCase() === etfCode.toUpperCase());
}
