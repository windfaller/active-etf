import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseKgiHoldings, parseKgiSummary } from "./parser.js";

export function normalizeKgiHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseKgiHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "kgi"
  }));
}

export function normalizeKgiSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseKgiSummary(raw.fetchResult.rawBody);

  return {
    etfCode: raw.etfCode,
    tradeDate: summary.tradeDate,
    nav: summary.nav,
    marketPrice: null,
    premiumDiscount: null,
    totalUnits: summary.totalUnits,
    fundSize: summary.fundSize,
    netCreationUnits: summary.netCreationUnits,
    cashRatio: summary.stockRatio === null ? null : Number((100 - summary.stockRatio).toFixed(4)),
    stockRatio: summary.stockRatio,
    sourceProvider: "kgi"
  };
}
