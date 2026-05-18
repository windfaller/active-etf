# Troubleshooting

## ETF exists in provider registry but not in the frontend

The frontend only shows ETFs that are enabled in `src/config/etfs.ts`. Provider registry entries with `pending_reverse_engineering` are intentionally not enabled, because no verified endpoint exists yet.

## Daily refresh returns one provider error

`/api/jobs/daily-refresh` isolates each ETF. One failed ETF should return an error object for that ETF without deleting or corrupting other ETF data.

## Premium/discount is blank

The system needs both NAV from provider data and closing price from TWSE `STOCK_DAY`. If TWSE does not yet have a row for that trade date, `marketPrice` and `premiumDiscount` remain `null`.

## A provider changed its website

Do not patch global sync code first. Fix only that provider folder:

- `src/providers/<provider>/provider.ts`
- `src/providers/<provider>/parser.ts`
- `src/providers/<provider>/normalizer.ts`
- `src/providers/<provider>/types.ts`

Raw snapshots should make the failing payload reproducible.

## Logic App should not be changed for new ETF logic

Keep Logic App pointed at:

```txt
POST /api/jobs/daily-refresh
```

New ETF providers and new analysis steps should be added in code behind that endpoint.

## Telegram users do not receive notifications

Check these app settings first:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL=https://active-etf.chicoo.co`
- `TELEGRAM_ETF_ONBOARDING_CHAT_IDS` for new active ETF onboarding alerts

Then call `POST /api/jobs/telegram/set-webhook` with `x-admin-token`. Ask the user to send `/start` to the bot; this should create or update a row in `telegram_subscribers`. If `TELEGRAM_ALLOWED_USER_IDS` or `TELEGRAM_ALLOWED_CHAT_IDS` is configured, the sender must be in one of those allowlists.
