import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseFirstHoldings, parseFirstSummary } from "./parser.js";

export function normalizeFirstHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseFirstHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "first"
  }));
}

export function normalizeFirstSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseFirstSummary(raw.fetchResult.rawBody);

  return {
    etfCode: raw.etfCode,
    tradeDate: summary.tradeDate,
    nav: summary.nav,
    marketPrice: null,
    premiumDiscount: null,
    totalUnits: summary.totalUnits,
    fundSize: summary.fundSize,
    netCreationUnits: summary.netCreationUnits,
    stockRatio: summary.stockRatio,
    cashRatio: null,
    sourceProvider: "first"
  };
}
