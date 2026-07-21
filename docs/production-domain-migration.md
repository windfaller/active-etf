# Production domain and legacy 301 migration

The only canonical production origin is:

```text
https://active-etf.inthewins.com
```

The repository now emits this origin for canonical links, Open Graph, Twitter metadata, JSON-LD, sitemap, robots.txt, Telegram webhook defaults, and build-time prerendered route HTML. Local Vite and API addresses remain relative/local and are not replaced by the production origin.

## What the repository controls

- `public/staticwebapp.config.json` serves prerendered HTML with revalidation, `app-version.json` with `no-store`, and hashed assets with a one-year immutable cache.
- Vite produces a static `index.html` for every configured Taiwan ETF route, overseas ETF route, and institution 13F route.
- Unknown `/etf/*`, `/global-etfs/*`, and `/institutions/*` paths are excluded from the SPA fallback. Azure Static Web Apps therefore returns its normal not-found response instead of silently selecting a default ETF.
- The legacy host is recognized only so server-side URL helpers normalize it to `active-etf.inthewins.com`.

## Why the cross-domain 301 is not in `staticwebapp.config.json`

Azure Static Web Apps route rules match request paths, not the incoming host. An absolute redirect rule for `/*` would also run on `active-etf.inthewins.com` and create a loop. A DNS CNAME also does not emit an HTTP 301 response.

Keep the old host's TLS certificate active and add a host-aware redirect at one of these layers:

1. Azure Front Door: add both hosts, route the canonical host to the Static Web App, and add a redirect route for `active-etf.chicoo.co/*` with status `301`, destination host `active-etf.inthewins.com`, and path/query preservation enabled.
2. Cloudflare: proxy the old DNS record and add a Redirect Rule where hostname equals `active-etf.chicoo.co`; target `https://active-etf.inthewins.com${uri.path}` with the original query string preserved; status code `301`.
3. A separate minimal redirect site: bind only the old hostname and return `301 Location: https://active-etf.inthewins.com<same path and query>`.

Do not point the old and new hostname at a host-blind redirect rule on the same Static Web App.

## Azure Portal / DNS checklist

1. Confirm `active-etf.inthewins.com` is validated under Static Web App > Custom domains and its certificate is healthy.
2. Select one host-aware redirect layer above and keep `active-etf.chicoo.co` attached there with a valid certificate.
3. Configure the old hostname redirect to preserve the full request path and query string.
4. Submit only `https://active-etf.inthewins.com/sitemap.xml` in Search Console.
5. Keep the redirect for at least 12 months; do not remove the old DNS record immediately.
6. Validate representative paths:

```sh
curl -I https://active-etf.chicoo.co/market
curl -I https://active-etf.chicoo.co/etf/00981A/changes
```

Each response must be `301` with the matching `https://active-etf.inthewins.com/...` location. Also verify the canonical host responds `200` without another redirect loop.
