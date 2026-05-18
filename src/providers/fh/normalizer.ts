import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseFhHoldings, parseFhSummary } from "./parser.js";

export function normalizeFhHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseFhHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "fh"
  }));
}

export function normalizeFhSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseFhSummary(raw.fetchResult.rawBody);

  return {
    etfCode: raw.etfCode,
    tradeDate: summary.tradeDate,
    nav: summary.nav,
    marketPrice: null,
    premiumDiscount: null,
    totalUnits: summary.totalUnits,
    fundSize: summary.fundSize,
    netCreationUnits: summary.netCreationUnits,
    cashRatio: summary.cashRatio,
    stockRatio: summary.stockRatio,
    sourceProvider: "fh"
  };
}
