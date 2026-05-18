import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseFubonHoldings, parseFubonSummary } from "./parser.js";

export function normalizeFubonHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseFubonHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "fubon"
  }));
}

export function normalizeFubonSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseFubonSummary(raw.fetchResult.rawBody);

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
    stockRatio: null,
    sourceProvider: "fubon"
  };
}
