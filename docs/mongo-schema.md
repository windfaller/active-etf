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

### `stock_daily_market`

Daily TWSE/TPEx stock quote and trading rows used to enrich cross-ETF impact rankings.

Unique key:

- `tradeDate`
- `stockId`

Important fields:

- `market`
- `openPrice`
- `highPrice`
- `lowPrice`
- `closePrice`
- `change`
- `changePercent`
- `volumeShares`
- `turnover`
- `transactionCount`
- `source`

### `stock_institutional_flows`

Daily 三大法人 net buy/sell rows used to compare ETF active changes against market institutional flow.

Unique key:

- `tradeDate`
- `stockId`

Important fields:

- `market`
- `foreignNetShares`
- `investmentTrustNetShares`
- `dealerNetShares`
- `totalNetShares`
- `source`

### `stock_sector_profiles`

Stock sector/theme classification used by sector flow and dashboard enrichment. Current source is a static map plus conservative stock-name fallback; unknown rows remain `其他`. Theme tags are multi-value labels such as `AI伺服器`, `CPO`, `CoWoS`, `重電`, `金控`, or `記憶體`.

Unique key:

- `stockId`

Important fields:

- `stockName`
- `sector`
- `themeTags`
- `source`

Refresh paths:

- Daily market-intelligence sync upserts profiles for the refreshed market date.
- Weekly profile refresh can call `POST /api/jobs/sector-profiles/refresh` to recompute tags from the latest market and ETF holding rows.

### `active_etf_discoveries`

Official TWSE ETFortune active ETF registry comparison rows. This collection records listed active ETFs that are already tracked and newly discovered ETFs that still need provider mapping or reverse engineering.

Unique key:

- `etfCode`

Important fields:

- `stockName`
- `listingDate`
- `issuer`
- `isTracked`
- `configuredProviderId`
- `suggestedProviderId`
- `discoveryStatus`
- `rawSnapshotId`
- `firstDetectedAt`
- `lastSeenAt`
- `lastNotifiedAt`

### `global_etf_raw_snapshots`

Raw official-source evidence for the overseas ETF product line. Shape follows `raw_snapshots`, but it is stored separately so global ETF sync cannot pollute Taiwan active ETF evidence workflows.

Important fields:

- `source`
- `etfCode`
- `dataType`
- `tradeDate`
- `url`
- `responseStatus`
- `rawContentType`
- `rawBody`
- `parsedOk`
- `parseError`

### `global_etf_snapshots`

Normalized overseas ETF snapshot document. One document contains metadata plus the normalized `holdings` array for a single source date/fetch.

Important fields:

- `snapshotId`
- `etfCode`
- `sourceAsOf`
- `filedAt` (optional; SEC 13F filing date)
- `capturedAt` (optional ISO timestamp; normalized acquisition time)
- `fetchedAt`
- `sourceUrl`
- `sourceStatus`
- `productGroup: "global_etf"`
- `market: "US"`
- `strategyType`
- `rowCount`
- `rawRowCount`
- `signature`
- `holdings`
- `unusableReason`

EUV snapshots that look like historical aggregation pollution should be marked unusable and skipped as previous-comparison baselines.

For `strategyType: "13f"`, `sourceAsOf` is the SEC `reportDate` (period of report), not the filing date. Older snapshots without `filedAt` are read with metadata recovered from their linked SEC submissions raw snapshot when available.

### `global_etf_holding_changes`

Overseas ETF position-level changes calculated from the latest usable snapshot versus the previous usable snapshot.

Important fields:

- `etfCode`
- `sourceAsOf`
- `prevSourceAsOf`
- `positionKey`
- `ticker`
- `name`
- `prevWeightPercent`
- `currentWeightPercent`
- `deltaPp`
- `prevShares`
- `currentShares`
- `deltaShares`
- `prevMarketValue`
- `currentMarketValue`
- `deltaMarketValue`
- `status`

### `telegram_subscribers`

Telegram users, chats, groups, and their notification preferences. A row is created or updated when Telegram sends a message to `/api/telegram/webhook`, including `/start`.

Unique key:

- `chatId`

Important fields:

- `chatId`
- `chatType`
- `telegramUserId`
- `username`
- `firstName`
- `lastName`
- `languageCode`
- `chatTitle`
- `enabled`
- `allowed`
- `blockedReason`
- `subscriptions.discovery`
- `subscriptions.dailyDigest`
- `lastCommand`
- `lastMessageAt`
- `createdAt`
- `updatedAt`
