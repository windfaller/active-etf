# Active ETF Tracking System Plan

This project follows the MVP plan in `/Users/chi/Downloads/codex_unipresident_active_etf_plan.txt`.

## MVP Focus

- Track Uni-President active ETF holdings, starting from configurable ETF `00981A` with fund code `49YTW`.
- Preserve every raw source response before parsing.
- Calculate holding changes and active-manager signals after adjusting for ETF unit growth or shrinkage.
- Expose API endpoints for holdings, changes, summaries, and rankings.
- Keep notification providers abstract, with Telegram as the first implementation.

## Development Stages

1. Source reverse engineering and raw snapshots.
2. Holdings and summary parser with MongoDB writes.
3. Daily diff engine.
4. Active signal engine.
5. REST APIs.
6. Telegram digest.
7. Future Forvix frontend module.

## Data Interpretation Rules

- Store stock position sizes in shares. Lots are derived as `shares / 1000`.
- Store weights as percentage values, for example `8.47` for `8.47%`.
- Keep `tradeDate` as the Taiwan trading date in `YYYY-MM-DD`.
- Keep `fetchedAt` as a timestamp of when the source was fetched.
- Do not treat plain share increases as active increases until ETF scale is adjusted.

## Disclaimer

This system organizes public ETF disclosure data for research. It is not investment advice. ETF holding disclosure can lag; official issuer and exchange announcements remain the source of truth.
