# API Spec

## Runtime Config

`GET /api/config`

Returns public runtime feature flags for the frontend. `ads.enabled` is controlled by the Azure Static Web Apps runtime app setting `ENABLE_ADS=true`; `VITE_ENABLE_ADS=true` is also accepted as a backward-compatible alias. Defaults to disabled. `ads.trackingEnabled` is controlled separately by `ENABLE_AD_TRACKING=true`.

## Get Holdings

`GET /api/etf/{etfCode}/holdings?date=YYYY-MM-DD`

Returns holdings for one ETF and trade date.

## Get Changes

`GET /api/etf/{etfCode}/changes?date=YYYY-MM-DD`

Returns top increases, decreases, active increases, active decreases, new holdings, exits, and `tagMovements` that aggregate the ETF manager's latest active movement by theme tag.

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

Returns stock-level impact ranking across all tracked active ETFs for a date. Rows include ETF active holding impact plus joined `sector`, daily market quote/trading fields, and 三大法人 net buy/sell fields when available.

## Get Global ETFs

`GET /api/global-etfs/enabled`

Returns the enabled overseas ETF product line and the candidate universe that still needs official endpoint verification. These rows are separate from `src/config/etfs.ts`.

## Get Global ETF Daily Report

`GET /api/global-etfs/daily-report?date=YYYY-MM-DD`

Returns the Traditional Chinese Global ETF Holdings Radar report with source status rows, all-ETF movers, per-ETF Top 10 holdings, source links, and Forvix ad context tags. `date` is optional; when provided, each ETF uses the latest usable official snapshot whose `sourceAsOf` is on or before that date. If no `global_etf_snapshots` exist in local development, the dev API returns a `demoMode: true` report so the UI can be inspected without polluting production data.

## Get Global ETF Dates

`GET /api/global-etfs/dates?limit=180`

Returns distinct ISO `sourceAsOf` dates from usable overseas ETF snapshots, newest first. The frontend uses this list for the overseas ETF date selector.

## Get Global ETF Holdings

`GET /api/global-etf/{etfCode}/holdings?date=YYYY-MM-DD`

Returns the normalized Top 10 holdings for one enabled overseas ETF. `date` is optional and follows the same as-of rule as the daily report.

## Get Global ETF Changes

`GET /api/global-etf/{etfCode}/changes?date=YYYY-MM-DD`

Returns new/exited positions, weight/share/market-value changes, and sector/country aggregates for one enabled overseas ETF. `date` is optional and follows the same as-of rule as the daily report.

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

## Admin Enabled ETF List

`POST /api/jobs/etfs/enabled`

Returns the current enabled ETF list from `src/config/etfs.ts` for external schedulers. Logic App can call this endpoint first and iterate over `result.etfs` so future ETF additions or removals do not require editing the Logic App workflow. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Daily Refresh

`POST /api/jobs/daily-refresh`

Universal scheduler entrypoint. Runs active ETF discovery, holdings/NAV sync, TWSE closing-price sync, daily-change calculation, consensus calculation, sector-flow calculation, TWSE/TPEx daily market intelligence sync for every refreshed trade date, and Global ETF official holdings sync. Logic App should call this endpoint so future ETF or job-step changes can be handled in code without changing the workflow. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

For Azure Static Web Apps managed Functions, prefer the split Logic App flow when the full refresh risks backend timeout: call `discover-active-etfs`, `etfs/enabled`, loop through per-ETF `sync-holdings` and `calculate-changes`, call `aggregates`, then call `global-etfs/sync-holdings`.

## Admin Global ETF Sync Holdings

`POST /api/jobs/global-etfs/sync-holdings`

Runs official-source holdings sync for all enabled overseas ETFs and 13F portfolios configured in `src/config/globalEtfs.ts`. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

`POST /api/jobs/global-etf/{etfCode}/sync-holdings`

Runs official-source holdings sync for one enabled overseas ETF. Raw responses are saved under `global_etf_raw_snapshots`, normalized snapshots under `global_etf_snapshots`, and changes under `global_etf_holding_changes`.

Production scheduling should call the HTTP admin endpoint from GitHub Actions or Logic App. The repository includes `.github/workflows/global-etf-sync.yml`, which triggers the all-global sync at `07:15` and `21:45` Asia/Taipei on weekdays when the `ADMIN_JOB_TOKEN` GitHub secret is configured. Static Web Apps managed Functions expose HTTP APIs; non-HTTP timer triggers require a separate bring-your-own Functions app. SEC 13F filings do not include exchange tickers, so ticker display is enriched only by the conservative CUSIP mapping in `src/config/globalHoldingTickerMap.ts`; unmapped or private/SPV positions remain `-`.

## Admin Daily Aggregates

`POST /api/jobs/aggregates?date=YYYY-MM-DD`

Runs consensus calculation, sector-flow calculation, and TWSE/TPEx daily market intelligence sync for one date. `date` is optional; if omitted, the job uses the latest available `etf_holding_changes.tradeDate`. This is intended for split scheduler workflows after per-ETF holdings and changes are complete. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Market Intelligence Sync

`POST /api/jobs/market-intelligence?date=YYYY-MM-DD`

Runs only the shared TWSE/TPEx market intelligence sync for one date. This fetches daily stock quotes/trading values and 三大法人 flows, stores raw snapshots, upserts `stock_daily_market`, `stock_institutional_flows`, and `stock_sector_profiles`, then clears dashboard cache for that date. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Sector Profile Refresh

`POST /api/jobs/sector-profiles/refresh`

Refreshes `stock_sector_profiles` from the latest `stock_daily_market` and `etf_daily_holdings` rows using the local sector/theme-tag mapping rules. This is intended for weekly Logic App scheduling so tag changes can be applied without waiting for the next market-intelligence run. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Active ETF Discovery

`POST /api/jobs/discover-active-etfs?notify=true`

Fetches the official TWSE ETFortune active ETF screener (`managerType=Active`), stores a raw snapshot, upserts `active_etf_discoveries`, compares official products with currently tracked ETFs, and optionally sends a Telegram onboarding notification for newly detected untracked ETFs. Onboarding alerts are sent only to `TELEGRAM_ETF_ONBOARDING_CHAT_IDS` and include a `taiwan-active-etf-onboarding` prompt for manual Codex follow-up. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`.

## Admin Telegram Set Webhook

`POST /api/jobs/telegram/set-webhook`

Registers the Telegram bot webhook to `{PUBLIC_BASE_URL}/api/telegram/webhook`. Production default is `https://active-etf.inthewins.com/api/telegram/webhook`. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`. Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`.

## Admin Telegram Daily Digest

`POST /api/jobs/telegram/daily-digest?etfCode=00981A&date=YYYY-MM-DD`

Sends the Telegram daily adjustment digest to enabled subscribers whose `dailyDigest` subscription is on. `etfCode` is optional and defaults to `00981A`. `date` is optional; if omitted, the endpoint uses the latest available `etf_holding_changes.tradeDate` for that ETF so Logic App schedules do not fail on weekends, holidays, or delayed source disclosure. Include `x-admin-token`; the value must match `ADMIN_JOB_TOKEN`. Requires `TELEGRAM_BOT_TOKEN` and either enabled subscribers or legacy `TELEGRAM_CHAT_ID`.

## Telegram Webhook

`POST /api/telegram/webhook`

Telegram Bot API callback endpoint. Telegram must send the `x-telegram-bot-api-secret-token` header matching `TELEGRAM_WEBHOOK_SECRET`. Message updates are stored in `telegram_subscribers`; `/start`, `/subscribe`, `/unsubscribe`, `/toggle`, `/discover_on`, `/discover_off`, `/digest_on`, `/digest_off`, and `/status` update notification state. `/latest` returns the latest cross-ETF stock-impact ranking, and `/latest {etfCode}` returns the latest single-ETF daily change digest.

## Get Consecutive Signals

`GET /api/etf/{etfCode}/consecutive?days=5`

Planned endpoint for consecutive active increases.
