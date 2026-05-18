import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseMegaHoldings, parseMegaSummary } from "./parser.js";

export function normalizeMegaHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseMegaHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "mega"
  }));
}

export function normalizeMegaSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseMegaSummary(raw.fetchResult.rawBody);

  return {
    etfCode: raw.etfCode,
    tradeDate: summary.tradeDate,
    nav: summary.nav,
    marketPrice: null,
    premiumDiscount: null,
    totalUnits: summary.totalUnits,
    fundSize: summary.fundSize,
    netCreationUnits: null,
    cashRatio: null,
    stockRatio: summary.stockRatio,
    sourceProvider: "mega"
  };
}
