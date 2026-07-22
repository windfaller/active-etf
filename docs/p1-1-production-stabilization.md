# P1.1 production stabilization runbook

## Canonical and legacy hosts

- Canonical: `https://active-etf.inthewins.com`
- Azure origin: `https://kind-coast-08b07e900.7.azurestaticapps.net`
- Legacy: `https://active-etf.chicoo.co`

The legacy host must return `301` for every path and preserve the original query string. The canonical host must return the route directly without redirecting back to itself.

Verified on 2026-07-22 (Asia/Taipei):

```text
https://active-etf.chicoo.co/
  301 -> https://active-etf.inthewins.com/
https://active-etf.chicoo.co/market
  301 -> https://active-etf.inthewins.com/market
https://active-etf.chicoo.co/etf/00981A/changes?date=2026-07-20
  301 -> https://active-etf.inthewins.com/etf/00981A/changes?date=2026-07-20
https://active-etf.inthewins.com/market
  200
```

These responses prove that a Cloudflare edge redirect is active. They do not identify whether the implementation is a Single Redirect, Bulk Redirect, Page Rule, or Worker. This checkout has no Cloudflare API token, MCP connector, or authenticated Wrangler session, so the management-plane rule type remains unverified.

If the redirect disappears, inspect the `chicoo.co` zone in **Rules > Redirect Rules**, **Bulk Redirects**, legacy **Page Rules**, and **Workers Routes**. Prefer one host-aware Single Redirect:

```text
Filter expression:
http.host eq "active-etf.chicoo.co"

Dynamic target expression:
concat("https://active-etf.inthewins.com", http.request.uri.path)

Status: 301
Preserve query string: enabled
```

The `active-etf.chicoo.co` DNS record must be proxied for a Single Redirect to run. Never replace the filter with a path-only expression: that could redirect the canonical host to itself.

Cloudflare reference:

- https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/
- https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/

## Cache contract

The application and Cloudflare edge must preserve this contract:

```text
HTML and prerendered route:
  Cache-Control: no-cache, must-revalidate

/app-version.json:
  Cache-Control: no-store

/assets/<hashed file>:
  Cache-Control: public, max-age=31536000, immutable
```

On 2026-07-22, the custom domain returned `CF-Cache-Status: DYNAMIC` for `/`, `/market`, and `/app-version.json`. The hashed application JavaScript returned the immutable one-year header. The Azure origin returned the same HTML cache contract without Cloudflare headers.

If a future Cloudflare Cache Rule overrides these origin headers, select **Respect origin** or use a narrowly scoped **Bypass cache** rule for HTML and `/app-version.json`. Do not purge hashed assets during an HTML/version-manifest incident. Purge only the affected HTML URLs and `/app-version.json` after correcting the rule.

Cloudflare reference:

- https://developers.cloudflare.com/cache/concepts/cache-control/
- https://developers.cloudflare.com/cache/how-to/cache-rules/settings/

## Deployment verification

The main deployment workflow runs the smoke test twice after deployment and the bounded index job:

1. Azure origin with `EXPECTED_VERSION=${GITHUB_SHA}`.
2. Canonical custom domain plus legacy redirect checks.

Manual invocation:

```bash
BASE_URL=https://active-etf.inthewins.com \
EXPECTED_VERSION=<full-github-sha> \
CHECK_LEGACY_REDIRECT=true \
npm run smoke:production
```

The script validates route HTML, canonical/noindex behavior, cache headers, hashed assets, core API schemas, the recommended market-date coverage rule, US history ISO dates and weight semantics, redirect preservation, endpoint durations, and the production data-health snapshot.
