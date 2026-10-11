# Stock query cache follow-up — 2026-10-11

## Confirmed production gap

PR #26 (8c48832) reduced overseas snapshot reads to indexed metadata and selected document hydration. SWA run 38112154637 and the independent native Function deployment completed successfully. Both origins served the release; native health returned 200, discovery 200 and anonymous MCP initialization 401. Authenticated real-user acceptance is separate.

Repeated public US MU history requests still took 8,069 and 9,569 ms because stock APIs loaded data from MongoDB on every request. Both returned HTTP 200. A visitor intentionally receives three preview points; an initial verifier incorrectly expected the internal 20-point result. Stock search uses /api/stocks/search and symbol, while generic /api/search uses code; these validation mistakes were corrected before follow-up acceptance.

## Repair

- Add bounded L1 (64 entries / 180 seconds) and shared Redis (600 seconds) caching to stock search, overview, history, ETF details and institution details.
- Reuse authoritative TW/global generation pointers and existing writer invalidation. Keys include market, operation, enabled universe, symbol, source date, history window, search query and result limit. Combined-market search depends on both generations.
- Cache complete data only. Check member identity and apply visitor previews/masks on every request, including cache hits. Protected responses remain private/no-store and vary by Cookie. Failed loads are not cached; unavailable version reads bypass both layers through the existing helper.
- Restrict Taiwan profile matches to identifiers accepted by Taiwan stock routes before the result limit. Mixed profile data previously mislabeled MU as a Taiwan stock with an invalid /stocks/tw/MU link.
- Apply requested generic-search stock market before limiting results so Taiwan hits cannot consume a US-only limit.

## Validation

379 tests passed; four existing opt-in Mongo integration tests skipped. Functions, MCP, frontend build and prerender checks passed. New regressions cover shared raw data with visitor/member isolation, repeat identity validation after expiry, concurrent load coalescing, committed generation invalidation, separate windows/dates, valid Taiwan/US routes and US-only limits. Existing application-only Azure plan records package and target checks.

After merge/deployment, record exact versions, HTTP status/response semantics, server cache hits and before/after timings. Bounded samples establish behavior for tested requests; they do not establish production p95 or all cold starts.
