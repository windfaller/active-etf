import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseTaishinHoldings, parseTaishinSummary } from "./parser.js";

export function normalizeTaishinHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseTaishinHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "taishin"
  }));
}

export function normalizeTaishinSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseTaishinSummary(raw.fetchResult.rawBody);

  return {
    etfCode: raw.etfCode,
    tradeDate: summary.tradeDate,
    nav: summary.nav,
    marketPrice: null,
    premiumDiscount: null,
    totalUnits: summary.totalUnits,
    fundSize: summary.fundSize,
    netCreationUnits: summary.netCreationUnits,
    cashRatio: null,
    stockRatio: summary.stockRatio,
    sourceProvider: "taishin"
  };
}
