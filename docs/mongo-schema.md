# Mongo Schema

## Existing Collections

### `etf_master`

ETF metadata used by sync jobs and the frontend ETF selector.

### `raw_snapshots`

Immutable raw request/response evidence.

Important fields:

- `source`
- `etfCode`
- `fundCode`
- `dataType`
- `tradeDate`
- `url`
- `method`
- `requestHeaders`
- `requestBody`
- `responseStatus`
- `rawContentType`
- `rawBody`
- `parsedOk`
- `parseError`

### `etf_daily_holdings`

Normalized holdings by ETF/date/stock.

Unique key:

- `etfCode`
- `tradeDate`
- `stockId`

### `etf_daily_summary`

Normalized ETF summary by ETF/date.

Unique key:

- `etfCode`
- `tradeDate`

### `etf_holding_changes`

Daily holdings changes and scale-adjusted active signals.

Unique key:

- `etfCode`
- `tradeDate`
- `stockId`

## New Collections

### `etf_consensus`

Cross-ETF stock-level consensus rows generated from `etf_holding_changes`.

Unique key:

- `tradeDate`
- `stockId`

### `etf_sector_flow`

Sector-level flow rows generated from mapped stocks in `etf_holding_changes`.

Unique key:

- `tradeDate`
- `sector`
