import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseJpmorganHoldings, parseJpmorganSummary } from "./parser.js";

export function normalizeJpmorganHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseJpmorganHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "jpmorgan"
  }));
}

export function normalizeJpmorganSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseJpmorganSummary(raw.fetchResult.rawBody);

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
    sourceProvider: "jpmorgan"
  };
}
