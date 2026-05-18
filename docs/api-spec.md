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

## Admin Daily Refresh

`POST /api/jobs/daily-refresh`

Universal scheduler entrypoint. Runs active ETF discovery, holdings/NAV sync, TWSE closing-price sync, daily-change calculation, consensus calculation, and sector-flow calculation for every enabled ETF. Logic App should call this endpoint so future ETF or job-step changes can be handled in code without changing the workflow. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Active ETF Discovery

`POST /api/jobs/discover-active-etfs?notify=true`

Fetches the official TWSE ETFortune active ETF screener (`managerType=Active`), stores a raw snapshot, upserts `active_etf_discoveries`, compares official products with currently tracked ETFs, and optionally sends a Telegram notification for newly detected untracked ETFs. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Telegram Set Webhook

`POST /api/jobs/telegram/set-webhook`

Registers the Telegram bot webhook to `{PUBLIC_BASE_URL}/api/telegram/webhook`. Production default is `https://active-etf.chicoo.co/api/telegram/webhook`. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`. Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`.

## Telegram Webhook

`POST /api/telegram/webhook`

Telegram Bot API callback endpoint. Telegram must send the `x-telegram-bot-api-secret-token` header matching `TELEGRAM_WEBHOOK_SECRET`. Message updates are stored in `telegram_subscribers`; `/start`, `/subscribe`, `/unsubscribe`, `/toggle`, `/discover_on`, `/discover_off`, `/digest_on`, `/digest_off`, and `/status` update notification state. `/latest` returns the latest cross-ETF stock-impact ranking, and `/latest {etfCode}` returns the latest single-ETF daily change digest.

## Get Consecutive Signals

`GET /api/etf/{etfCode}/consecutive?days=5`

Planned endpoint for consecutive active increases.
