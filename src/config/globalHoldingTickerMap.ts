export interface GlobalHoldingTickerMapEntry {
  ticker: string;
  source: "manual_13f_cusip_map";
}

// SEC 13F filings expose CUSIP but not exchange tickers. Keep this map conservative:
// only high-confidence CUSIP -> listed ticker pairs should be auto-applied. Tools such
// as moomoo can help validate ticker/name candidates, but unmapped or private/SPV
// positions must remain blank in the UI until confirmed.
const sec13fCusipTickerMap = new Map<string, GlobalHoldingTickerMapEntry>([
  ["007903107", { ticker: "AMD", source: "manual_13f_cusip_map" }],
  ["01609W102", { ticker: "BABA", source: "manual_13f_cusip_map" }],
  ["02079K107", { ticker: "GOOG", source: "manual_13f_cusip_map" }],
  ["02079K305", { ticker: "GOOGL", source: "manual_13f_cusip_map" }],
  ["023135106", { ticker: "AMZN", source: "manual_13f_cusip_map" }],
  ["025816109", { ticker: "AXP", source: "manual_13f_cusip_map" }],
  ["037833100", { ticker: "AAPL", source: "manual_13f_cusip_map" }],
  ["060505104", { ticker: "BAC", source: "manual_13f_cusip_map" }],
  ["11271J107", { ticker: "BN", source: "manual_13f_cusip_map" }],
  ["166764100", { ticker: "CVX", source: "manual_13f_cusip_map" }],
  ["172573107", { ticker: "CRCL", source: "manual_13f_cusip_map" }],
  ["191216100", { ticker: "KO", source: "manual_13f_cusip_map" }],
  ["19260Q107", { ticker: "COIN", source: "manual_13f_cusip_map" }],
  ["30303M102", { ticker: "META", source: "manual_13f_cusip_map" }],
  ["42806J700", { ticker: "HTZ", source: "manual_13f_cusip_map" }],
  ["44267T102", { ticker: "HHH", source: "manual_13f_cusip_map" }],
  ["500754106", { ticker: "KHC", source: "manual_13f_cusip_map" }],
  ["594918104", { ticker: "MSFT", source: "manual_13f_cusip_map" }],
  ["595112103", { ticker: "MU", source: "manual_13f_cusip_map" }],
  ["615369105", { ticker: "MCO", source: "manual_13f_cusip_map" }],
  ["629377508", { ticker: "NRG", source: "manual_13f_cusip_map" }],
  ["67066G104", { ticker: "NVDA", source: "manual_13f_cusip_map" }],
  ["674599105", { ticker: "OXY", source: "manual_13f_cusip_map" }],
  ["69608A108", { ticker: "PLTR", source: "manual_13f_cusip_map" }],
  ["76131D103", { ticker: "QSR", source: "manual_13f_cusip_map" }],
  ["770700102", { ticker: "HOOD", source: "manual_13f_cusip_map" }],
  ["82509L107", { ticker: "SHOP", source: "manual_13f_cusip_map" }],
  ["874039100", { ticker: "TSM", source: "manual_13f_cusip_map" }],
  ["88023B103", { ticker: "TEM", source: "manual_13f_cusip_map" }],
  ["880770102", { ticker: "TER", source: "manual_13f_cusip_map" }],
  ["88160R101", { ticker: "TSLA", source: "manual_13f_cusip_map" }],
  ["90353T100", { ticker: "UBER", source: "manual_13f_cusip_map" }],
  ["92840M102", { ticker: "VST", source: "manual_13f_cusip_map" }],
  ["H1467J104", { ticker: "CB", source: "manual_13f_cusip_map" }],
  ["H17182108", { ticker: "CRSP", source: "manual_13f_cusip_map" }]
]);

export function mappedTickerForSec13fCusip(cusip: string | undefined): GlobalHoldingTickerMapEntry | undefined {
  return cusip ? sec13fCusipTickerMap.get(cusip.trim().toUpperCase()) : undefined;
}
