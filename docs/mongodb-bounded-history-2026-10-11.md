# Bounded overseas stock history reads — 2026-10-11

The user requested a fresh performance evaluation and implementation after PR #27/ece9fba. Production historical MU history cache miss still took 5,288 ms (data loading/computation 3,612 ms), followed by a 919 ms L1 hit. This establishes API-cache behavior, not host cold-start behavior.

## Findings and evaluated directions

The metadata selector already reads its covering index. The remaining history hydration forced `holdings.ticker_1_sourceAsOf_-1_etfCode_1`. Its case-insensitive regex has unbounded ticker ranges, so each request scanned 446,763 index entries and fetched 1,579 snapshots regardless of the smaller selected winner-ID list. Atlas slow-query logs corroborated this shape. Collection inspection confirmed the existing `_id_` index and all prior metadata indexes.

Atlas suggested a ticker/status/date compound index for another recorded query shape. It does not solve this hydration's unbounded regex, so no new index was created. A projected ticker/date candidate lookup was also evaluated, but its regex still required FETCH. Instead use the existing `_id_` index to bound hydration to the metadata winner list. Preserve the exact case-insensitive predicate and select only the ticker and weightPercent fields used by history calculations.

| Direct comparison | Previous forced ticker index | Existing ID index, same predicate |
| --- | --- | --- |
| MU, 20 points, cutoff 2026-10-02 | 2,150 ms / 446,763 keys / 1,579 documents | 646 ms / 742 keys / 704 documents |
| NVDA, five points | 1,255 ms / 446,763 keys / 1,579 documents | 58 ms / 238 keys / 224 documents |
| Absent symbol, three points | 1,083 ms / 446,763 keys / 1,579 documents | 31 ms / 169 keys / 160 documents |

These are bounded direct query samples against the same live data, without the API/Redis layer. They are not latency percentiles or physical-storage cold-start measurements.

## Implementation and validation

- Hydrate only selected IDs through `_id_`; retain the original regex semantics and metadata selection/date cutoff.
- Project matching ticker/weightPercent pairs instead of complete source holdings/raw rows. Metadata supplies ETF/date/timestamp fields.
- Keep empty observations so a valid exit cannot fall back to earlier positive holdings or disappear.
- Use stock-history cache revision v2 during rolling deployment; other stock cache keys stay unchanged and old entries expire through existing TTLs. Identity and visitor previews are still applied per request.

381 tests passed; four existing opt-in Mongo integration tests skipped. Functions, MCP, frontend/prerender and diff checks passed. New/updated regressions cover bounded winner IDs, mixed-case/multiple-asset compact weights, metadata-only dates, exits and empty selection.

Four actual source old/new live comparisons preserve every complete change point: MU historical/latest 20 points, NVDA five points and absent symbol zero. The final compact historical MU helper completed in 515 ms (including metadata selection), examined 742 keys/704 documents, and reduced observation JSON from 421,322 to 80,916 bytes. Latest MU completed in 458 ms, NVDA in 130 ms, absent symbol in 107 ms. No new indexes, collections, data migration, infrastructure, settings, dependencies or real-user quota changes.

Fresh package/target validation and the existing application-only Azure deployment recipe are recorded in `.azure/deployment-plan.md`. After deployment, verify exact versions and uncached/cache-hit public history requests, response cutoffs/masks, existing report/search routes and native health/authentication boundaries. Long-term p95 and real-user authenticated acceptance remain separate.
