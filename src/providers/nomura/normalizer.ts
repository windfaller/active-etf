import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseNomuraHoldings, parseNomuraSummary } from "./parser.js";

export function normalizeNomuraHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseNomuraHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "nomura"
  }));
}

export function normalizeNomuraSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseNomuraSummary(raw.fetchResult.rawBody);

  return {
    etfCode: raw.etfCode,
    tradeDate: summary.tradeDate,
    nav: summary.nav,
    marketPrice: null,
    premiumDiscount: null,
    totalUnits: summary.totalUnits,
    fundSize: summary.fundSize,
    netCreationUnits: null,
    cashRatio: summary.cashRatio,
    stockRatio: summary.stockRatio,
    sourceProvider: "nomura"
  };
}
