# API Spec

## Get Holdings

`GET /api/etf/{etfCode}/holdings?date=YYYY-MM-DD`

Returns holdings for one ETF and trade date.

## Get Changes

`GET /api/etf/{etfCode}/changes?date=YYYY-MM-DD`

Returns top increases, decreases, active increases, active decreases, new holdings, and exits.

## Get Summary

`GET /api/etf/{etfCode}/summary?date=YYYY-MM-DD`

Returns NAV, market price, premium or discount, total units, fund size, and allocation ratios.

## Get Active Ranking

`GET /api/etf/active/ranking?date=YYYY-MM-DD`

Returns cross-ETF active-signal ranking.

## Admin Sync Holdings

`POST /api/admin/etf/{etfCode}/sync-holdings`

Runs the same holdings sync job used by the Azure Timer Trigger. The Azure Function uses `authLevel: "function"`, so production calls must include a function key.

## Admin Calculate Changes

`POST /api/admin/etf/{etfCode}/calculate-changes?date=YYYY-MM-DD`

Runs the same daily-change calculation job used by the Azure Timer Trigger. `date` is optional; if omitted, the job uses today's Taipei date. The Azure Function uses `authLevel: "function"`.

## Get Consecutive Signals

`GET /api/etf/{etfCode}/consecutive?days=5`

Planned endpoint for consecutive active increases.
