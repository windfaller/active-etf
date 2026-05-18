import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseAllianceBernsteinHoldings, parseAllianceBernsteinSummary } from "./parser.js";

export function normalizeAllianceBernsteinHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseAllianceBernsteinHoldings(raw.fetchResult.rawBody).map((holding) => ({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "allianceBernstein"
  }));
}

export function normalizeAllianceBernsteinSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseAllianceBernsteinSummary(raw.fetchResult.rawBody);

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
    stockRatio: null,
    sourceProvider: "allianceBernstein"
  };
}
