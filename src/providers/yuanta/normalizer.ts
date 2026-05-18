import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseYuantaHoldings, parseYuantaSummary } from "./parser.js";

export function normalizeYuantaHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseYuantaHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "yuanta"
  }));
}

export function normalizeYuantaSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseYuantaSummary(raw.fetchResult.rawBody);

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
    sourceProvider: "yuanta"
  };
}
