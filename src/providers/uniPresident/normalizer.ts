import type { NormalizedHolding, NormalizedSummary, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { parseEzmoneyHoldings, parseEzmoneyPcf } from "./parser.js";

export function normalizeUniPresidentHoldings(raw: RawHoldingResponse): NormalizedHolding[] {
  return parseEzmoneyHoldings({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    rawSnapshotId: "provider-normalize",
    rawBody: raw.fetchResult.rawBody,
    contentType: raw.fetchResult.rawContentType
  }).map((holding) => ({
    etfCode: holding.etfCode,
    tradeDate: holding.tradeDate,
    stockId: holding.stockId,
    stockName: holding.stockName,
    shares: holding.shares,
    lots: holding.lots,
    weight: holding.weight,
    marketValue: holding.marketValue,
    sourceProvider: "uniPresident"
  }));
}

export function normalizeUniPresidentSummary(raw: RawSummaryResponse): NormalizedSummary {
  const summary = parseEzmoneyPcf({
    etfCode: raw.etfCode,
    tradeDate: raw.tradeDate,
    rawSnapshotId: "provider-normalize",
    rawBody: raw.fetchResult.rawBody,
    contentType: raw.fetchResult.rawContentType
  });

  return {
    etfCode: summary.etfCode,
    tradeDate: summary.tradeDate,
    nav: summary.nav,
    marketPrice: summary.marketPrice,
    premiumDiscount: summary.premiumDiscount,
    totalUnits: summary.totalUnits,
    fundSize: summary.fundSize,
    netCreationUnits: summary.netCreationUnits,
    cashRatio: summary.cashRatio,
    stockRatio: summary.stockRatio,
    sourceProvider: "uniPresident"
  };
}
