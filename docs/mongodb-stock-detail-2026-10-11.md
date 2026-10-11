# Overseas stock detail read improvement — 2026-10-11

## Diagnosis and implementation

The current-stock helper fetched every holding from 32 selected ETF snapshots even when a request needed only one ticker. ETF detail also fetched one full prior snapshot per matching ETF. Existing metadata and ID indexes already support selection; adding an array compound index would not reduce the oversized response payload.

Current and prior hydration now projects only the consumed snapshot metadata and target holding fields: ticker, positionKey, name, weightPercent, shares, marketValue, sector and assetType. All matching asset rows stay in their source order. Current snapshot validity is decided before ticker presence; an invalid capture may fall back, while a valid stock exit cannot. Exact-case presence and subsequent trimmed/case-normalized matching are preserved. Previous snapshots retain their earlier-date/status/latest-capture rules, including empty or unusable captures without backfilling an older holding.

Prior winners are selected once with the existing covering index, followed by one `_id_` batch hydration. US overview, ETF detail and institutions use cache key revision v2 during rolling deployment. Complete results remain cached before request-specific membership masking. No new index, data mutation, backfill, dependency, infrastructure, settings or role changes.

## Verification before deployment

Five direct-service response comparisons were completely identical after removing generatedAt: MU/NVDA/absent-symbol ETF detail, MU overview and MU 13F institutions. Unit regressions cover exits, invalid current capture fallback, distinct per-ETF prior dates, latest same-date captures, prior empty/unusable captures, mixed-case/multiple asset rows, zero/missing weights and member preview isolation.

| Direct-service sample | Before ms | After ms | Before read bytes | After read bytes |
| --- | ---: | ---: | ---: | ---: |
| MU ETF detail | 1,133 | 807 | 16,200,256 | 370,775 |
| NVDA ETF detail | 878 | 389 | 16,161,244 | 369,145 |
| Absent stock detail | 485 | 251 | 11,823,620 | 360,123 |
| MU overview | 485 | 372 | 12,049,249 | 368,553 |
| MU institutions | 30 | 52 | 225,658 | 6,146 |

Bytes are JSON-serialized database cursor batches, not network wire bytes. Single samples are not percentile estimates. The first MU call includes initial database client connection work. The small institutions request did not improve in this single timing sample; the projected payload is materially smaller.

MU ETF detail database read commands fell from 17 to 6, including metadata cursor batches. Transferred result size fell 97.7%. Actual execution statistics: current metadata 1,777 keys/zero documents, current hydration 34 keys/32 documents; prior metadata 795 keys/zero documents, prior hydration 23 keys/13 documents. Both metadata reads used `global_snapshot_read_metadata`, both hydration reads `_id_`; no collection scan.

Full regression: 385 passed, four existing opt-in database tests skipped. Functions/MCP/frontend builds, prerender and diff checks passed. Fresh bounded production baseline: `/api/stocks/us/MU/etfs` first request 2,993 ms, data-load 2,000 ms, both server caches missed; repeat 651 ms with cache hit and zero data loading. Visitor result has 13 rows/seven locked, private/no-store.

Atlas advisor still shows older pre-repair history slow logs and proposes additional snapshot indexes. Their logged 446,763-key scan belongs to the prior forced-ticker history path already replaced in PR #28. The new detail execution plans are covered/bounded; these advisor suggestions are not evidence that a new detail index is missing.

Evidence in the shared workspace: `analysis/mongodb-detail-audit-2026-10-11/detail-{before,after}.json`, `detail-plans.json`, `http-before.json` and their reproducible scripts. Production deployment and runtime verification are recorded separately after release.
