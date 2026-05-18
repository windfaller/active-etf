---
name: taiwan-active-etf-onboarding
description: Use when adding, detecting, or onboarding Taiwan active ETFs in the active-etf project. Covers TWSE ETFortune discovery, provider reverse engineering, Mongo sync, validation, and deployment-safe rules.
---

# Taiwan Active ETF Onboarding

Use this workflow for new Taiwan active ETF listings or new issuers in the active-etf codebase.

## Guardrails

- Do not guess provider APIs.
- Prefer official JSON, then CSV, XLSX, hidden table endpoints, and HTML parsing only as a final verified fallback.
- Save raw snapshots before normalized data is trusted.
- A new provider must fail in isolation and must not break existing ETFs.
- Do not enable a new ETF until holdings and summary/NAV fields are verified from a real response.

## Discovery

1. Use TWSE ETFortune as the official listing baseline:
   - `POST https://wwwc.twse.com.tw/zh/ETFortune-institute/ajaxProducts`
   - body: `managerType=Active&sort=listingDate&orderBy=DESC`
2. Compare `stockNo` with `etf_master` and `src/config/etfs.ts`.
3. Classify:
   - `tracked`: already enabled.
   - `needs_provider_mapping`: issuer has an existing provider, but this ETF code/fundCode is not configured.
   - `needs_provider_reverse_engineering`: issuer/provider is new or not verified.
4. Notify only newly detected untracked ETFs.

## Provider Onboarding

1. Open the official issuer product page and inspect scripts/XHR/network.
2. Capture real endpoint URL, method, headers, payload, response shape, and date behavior.
3. Implement files under `src/providers/{providerId}/`:
   - `types.ts`
   - `provider.ts`
   - `parser.ts`
   - `normalizer.ts`
4. Add ETF to `src/config/etfs.ts`.
5. Add source enums if a new provider/source is introduced:
   - `src/models/RawSnapshot.ts`
   - `src/models/EtfDailyHolding.ts`
   - `src/models/EtfDailySummary.ts`
   - `src/services/sync/providerDailyDataSync.ts`
6. Add focused parser/normalizer tests.

## Validation

Run:

```bash
PATH=/usr/local/bin:$PATH npm test -- --run
PATH=/usr/local/bin:$PATH npm run functions:build
PATH=/usr/local/bin:$PATH npm run build
```

Then live-smoke with the compiled provider, sync MongoDB, calculate changes, and recalculate consensus/sector flow for affected dates.

## Documentation

Update:

- `docs/provider-reverse-engineering.md`
- `docs/source-endpoints.md`
- `docs/api-spec.md` if routes change
- `docs/mongo-schema.md` if collections change

## Git

Commit only scoped files and push to `origin/main` after tests/build pass.
