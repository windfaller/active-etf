# Member MCP validation — 2026-09-22

Status: independent Azure Function deployed and all seven MCP tools passed live protocol tests. Real member login and ChatGPT/Grok acceptance remain incomplete. All public Skill pages/downloads are hidden per user instruction; no directory publication.

## Independent Function acceptance — 2026-09-22

- Endpoint: `https://active-etf-member-mcp.azurewebsites.net/api/mcp`.
- Resource `active-etf-member-mcp` in existing `active-etf` resource group. Flex Consumption FC1, East Asia, Node 24, 512 MB, maximum two on-demand instances, no always-ready instances. HTTPS only. This is serverless usage billing; storage, telemetry and network can incur separate charges.
- Official TypeScript Functions base template adapted to the existing resource group. Storage shared-key access and public blobs disabled. User-assigned identity has Storage Blob Data Owner on the new storage and Monitoring Metrics Publisher on new Insights; no new user-level role grants.
- Deployment ID `dcd5ff9a-0881-46e1-af15-ec544ef1df01`; Functions health 200 with MongoDB. Initial package build `abf95bf` uses an isolated HTTP entry; no market timers registered.
- Live standard Bearer initialize, tools/list and all seven tool calls passed against real research data (latest fixture ETF snapshots dated 2026-09-21). Initial full query sequence charged exactly 9 points; repeated snapshot charged zero; a second SDK client saw the same 9 used / 11 remaining balance. No real member quota was consumed.
- Live PKCE code exchange, replay rejection, refresh rotation and revocation passed. Test authorization codes were seeded directly for a unique fixture identity, then fixture records removed. This is not a real Firebase login or platform consent test.
- Browser verified the independent account page and navigation into GoGoWinners login with the correct Function callback. No authenticated member session available; real login callback not completed.
- All five Skill routes and all five downloads return 404 on the Function. On SWA, 20 exact/trailing-slash/index/download URL checks returned 404; the main-site footer entry was removed. Publication defaults false and stays false.
- Isolated regression suite: 288 passed, four opt-in real-Mongo tests skipped. Standalone-only registration and forbidden file/path checks passed.
- Detailed live evidence: `member-mcp-independent-smoke.json`.

## Current deployed evidence — 2026-09-22

- Application commit: `502601180519a451491dc8a242f3319d65c186a0`. GitHub Actions run [35688039014](https://github.com/windfaller/active-etf/actions/runs/35688039014) succeeded, including existing production route checks. Live app-version matches.
- Existing resource: `tw-active-etf`, resource group `active-etf`, Free SKU; no new cloud resource.
- Canonical origin is `https://active-etf.inthewins.com`; the chicoo.co hostname redirects. MCP_PUBLIC_ORIGIN was explicitly set without changing legacy PUBLIC_BASE_URL.
- All 15 language routes and five Skill downloads returned HTTP 200. Live browser verified overview, Skill navigation and correct URL, with no horizontal overflow at 1280px.
- MCP health reports MongoDB. Static and dynamic OAuth metadata agree; anonymous requests receive 401 and the correct discovery challenge. DCR, PKCE authorization redirect, consent metadata and secure login nonce cookie passed.
- Real OAuth token exchange passed using a uniquely named, short-lived test authorization code inserted directly into storage. This does NOT verify a real Firebase member login or platform consent.
- The issued access token exists in the same production database. The exact deployed handler accepts it when invoked directly, but the SWA public HTTP path returns 401 invalid_token. Therefore standard MCP initialize/list/call did NOT pass remotely.
- Microsoft confirms that managed SWA Functions overwrite Authorization for internal proxy authentication: [Azure issue 34](https://github.com/Azure/static-web-apps/issues/34#issuecomment-634117706). The official issue also identifies bring-your-own Functions as the alternative. No custom-header workaround or anonymous access was added.
- Temporary fixture access/refresh tokens, consent/client records and usage were cleaned up. No real member quota was consumed.
- Latest local verification: full suite 291 passed with real Mongo tests; isolated release 286 passed plus 4 opt-in tests skipped; latest targeted rerun 16/16 passed. Functions and frontend builds succeeded.
- Recommended next architecture: keep the five-language website on SWA; deploy this native MCP handler to a separate Azure Function with standard bearer forwarding and the same MongoDB/Redis. New resource/cost and endpoint must be agreed before that separate deployment.

## Earlier local validation (historical)

## Passed

- Full existing/new test suite: 70 files, 287 tests passed. The 12 OAuth/MCP/ledger cases were rerun successfully after the cache-charge correction.
- `npm run functions:build`, `npm run mcp:build`, `npm run web:build` succeeded.
- OAuth tests use an explicitly injected fixture identity verifier, not production login bypasses. They cover discovery, anonymous challenge, PKCE, resource binding, code replay, login-state cookie, CSRF/origin, refresh rotation/replay revocation, grant revocation, SDK initialize/list/call, and member-shared accounting.
- Ledger tests cover Taipei midnight, reservation/concurrency limits, quota, repeat queries, empty/error handling and expired/double completion.
- Six read-only providers were exercised against the existing research database, without database writes:

| Query | Result |
| --- | --- |
| Search 00981A | 1 supported ETF |
| 00981A snapshot | 50 holdings, 2026-09-21 |
| 00981A, last 7 days | 200 change observations, latest 2026-09-21 |
| Compare 00981A / 00991A | 2 fund cards, 2026-09-21 |
| Stock 2330 | 26 ETF rows, 2026-09-21 |
| Brief 00981A / 00991A | 2 fund research bundles with per-section dates |

These provider checks are not authenticated platform acceptance tests. The seventh tool (usage) is verified through the authenticated HTTP integration tests.

- All 15 built language routes include the app entry, correct document language and static-host rewrites. Authorization routes are noindex.
- All five generated SKILL.md files passed the skill-creator validator.
- Browser checks exercised English, Traditional Chinese, Simplified Chinese, Japanese and Korean content, language navigation, Skill download, and the signed-out account screen. Mobile layout was visually inspected. Existing business data names and legacy market/legal pages retain their source language.
- Actual member sign-in navigation reached the existing GoGoWinners login provider, which also displays all five required language options. A real member login callback was not completed.

## Platform tests not yet passed

### ChatGPT

Reached the user's authenticated account → Plugins → Developer mode. Developer mode is off. Enabling it requires action-time confirmation because the UI identifies it as permitting unverified connectors. Confirmation was requested; no change has been made. No custom MCP connection or tool call has completed.

### Grok

Reached Plugins → Connectors → New Connector → Custom and submitted a private connector named `ETF Research Beta` to the temporary HTTPS test endpoint. The service received one dynamic OAuth client registration. Edge then disconnected from the browser-control interface. Member authorization and a real tool call are unverified. A connector entry may remain in the user's Grok account; inspect that entry before retrying rather than creating duplicates.

## Remaining acceptance gates

1. Independent Function resolves the managed SWA Authorization-header limitation; use the Function endpoint, not the former SWA /api/mcp URL.
2. Complete real member sign-in, OAuth consent and tool calls on both ChatGPT and Grok after the endpoint is fixed. ChatGPT developer-mode confirmation and the disconnected Grok browser remain outstanding.
3. Verify usage → one holdings query → identical query → usage and shared cross-platform quota, then revoke/reconnect.
4. Do not publish either platform directory listing; that is outside the current request.

The prior temporary HTTPS tunnel is stopped. This document supersedes the earlier local-only deployment status. Details from the live server smoke test are in member-mcp-swa-smoke.json.
