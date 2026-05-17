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

## Get Summary History

`GET /api/etf/{etfCode}/summary-history?limit=90`

Returns recent NAV, market price, premium or discount, total units, and fund size rows.

## Get Active Ranking

`GET /api/etf/active/ranking?date=YYYY-MM-DD`

Returns cross-ETF active-signal ranking.

## Get Market Stock Impact

`GET /api/market/stock-impact?date=YYYY-MM-DD`

Returns stock-level impact ranking across all tracked active ETFs for a date.

## Admin Sync Holdings

`POST /api/jobs/etf/{etfCode}/sync-holdings`

Runs the holdings sync job for one ETF. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Sync Holdings All

`POST /api/jobs/etfs/sync-holdings`

Runs the holdings sync job for every enabled ETF in `src/config/etfs.ts`. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Calculate Changes

`POST /api/jobs/etf/{etfCode}/calculate-changes?date=YYYY-MM-DD`

Runs the daily-change calculation job for one ETF. `date` is optional; if omitted, the job uses today's Taipei date. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Calculate Changes All

`POST /api/jobs/etfs/calculate-changes?date=YYYY-MM-DD`

Runs the daily-change calculation job for every enabled ETF in `src/config/etfs.ts`. `date` is optional; if omitted, the job uses today's Taipei date. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Get Consecutive Signals

`GET /api/etf/{etfCode}/consecutive?days=5`

Planned endpoint for consecutive active increases.
