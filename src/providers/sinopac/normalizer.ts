import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseSinopacHoldings, parseSinopacSummary } from "./parser.js";

export function normalizeSinopacHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseSinopacHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "sinopac"
  }));
}

export function normalizeSinopacSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseSinopacSummary(raw.fetchResult.rawBody);
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
    sourceProvider: "sinopac"
  };
}
