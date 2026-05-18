import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseCtbcHoldings, parseCtbcSummary } from "./parser.js";

export function normalizeCtbcHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseCtbcHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "ctbc"
  }));
}

export function normalizeCtbcSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseCtbcSummary(raw.fetchResult.rawBody);

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
    sourceProvider: "ctbc"
  };
}
