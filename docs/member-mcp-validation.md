# Member MCP validation — 2026-09-22

Status: independent Azure Function deployed and all seven MCP tools passed live protocol tests. Real member login and ChatGPT/Grok acceptance remain incomplete. All public Skill pages/downloads are hidden per user instruction; no directory publication.

## Custom-domain acceptance — 2026-09-22

- Canonical MCP: `https://active-etf-mcp.inthewins.com/api/mcp`; member test portal: `https://active-etf-mcp.inthewins.com/zh-TW/mcp/connect`.
- Application release `0d74b6f67d9a117ea53334006e6fe39540e1d530`; [SWA deployment 35695044832](https://github.com/windfaller/active-etf/actions/runs/35695044832) succeeded. Function deployment `3040c5ce-cf7a-4023-874e-bb7de496116b` succeeded. Both live version endpoints match this release.
- Function and SWA `MCP_PUBLIC_ORIGIN` updated. Frontend fallback, CI build setting, static canonical links, root/API OAuth metadata, challenge discovery, resource binding, login callback, deployment configuration script and all localized Skill source instructions use the custom domain. Existing clients must update their MCP URL and reconnect through OAuth.
- 63 live checks passed: versions, ten localized connection pages, forty Skill 404 variants, three SWA discovery redirects, two runtime configs, five OAuth metadata endpoints and login callback origin. Browser confirmed the Traditional Chinese portal with five language options and no Skill link.
- Standard SDK client passed seven live tools through the custom domain, real PKCE exchange and code replay rejection, shared 9 used / 11 remaining quota, identical-query zero charge, refresh rotation and revocation. Used a unique seeded fixture authorization code; fixture records were cleaned up. This does not prove real Firebase login or ChatGPT/Grok acceptance.
- Evidence: `member-mcp-custom-domain-checks.json`, `member-mcp-custom-domain-smoke.json`. Earlier evidence files retain their historical URLs; they are not current configuration.
- Clean Functions/frontend builds and 14 targeted MCP tests passed (four opt-in Mongo tests skipped); live tests exercised Mongo-backed quota. Skill remains hidden and no platform listing was published.

## Independent Function acceptance — 2026-09-22

- Current canonical endpoint: `https://active-etf-mcp.inthewins.com/api/mcp`. The initial acceptance below used the Azure default hostname; see custom-domain verification for the current origin.
- Resource `active-etf-member-mcp` in existing `active-etf` resource group. Flex Consumption FC1, East Asia, Node 24, 512 MB, maximum two on-demand instances, no always-ready instances. HTTPS only. This is serverless usage billing; storage, telemetry and network can incur separate charges.
- Official TypeScript Functions base template adapted to the existing resource group. Storage shared-key access and public blobs disabled. User-assigned identity has Storage Blob Data Owner on the new storage and Monitoring Metrics Publisher on new Insights; no new user-level role grants.
- Deployment ID `dcd5ff9a-0881-46e1-af15-ec544ef1df01`; Functions health 200 with MongoDB. Initial package build `abf95bf` uses an isolated HTTP entry; no market timers registered.
- Live standard Bearer initialize, tools/list and all seven tool calls passed against real research data (latest fixture ETF snapshots dated 2026-09-21). Initial full query sequence charged exactly 9 points; repeated snapshot charged zero; a second SDK client saw the same 9 used / 11 remaining balance. No real member quota was consumed.
- Live PKCE code exchange, replay rejection, refresh rotation and revocation passed. Test authorization codes were seeded directly for a unique fixture identity, then fixture records removed. This is not a real Firebase login or platform consent test.
- Browser verified the independent account page and navigation into GoGoWinners login with the correct Function callback. No authenticated member session available; real login callback not completed.
- All five Skill routes and all five downloads return 404 on the Function. On SWA, 20 exact/trailing-slash/index/download URL checks returned 404; the main-site footer entry was removed. Publication defaults false and stays false.
- Isolated regression suite: 288 passed, four opt-in real-Mongo tests skipped. Standalone-only registration and forbidden file/path checks passed.
- Detailed live evidence: `member-mcp-independent-smoke.json`.

## Resumed deployment verification — 2026-09-22

- Final SWA run [35690619468](https://github.com/windfaller/active-etf/actions/runs/35690619468) succeeded. SWA and independent Function both serve release `18c9792` (SWA reports the full commit).
- All 55 public HTTP checks passed: two version endpoints, ten localized connection pages, forty hidden Skill page/download variants, and three SWA discovery redirects to the independent Function. Evidence: `member-mcp-resume-checks.json`.
- Edge rendered the independent Traditional Chinese connection portal with all five language choices and no Skill navigation. Free-member login navigated to GoGoWinners with the Function callback. Google login was attempted, but Edge disconnected before an authenticated callback could be observed. Do not count this as successful member login.
- ChatGPT developer mode remains off. Action-time confirmation was requested again at the visible security control; it was not enabled. Grok's page opened, but browser control disconnected before connector inspection or endpoint update. The existing private connector still requires inspection before retrying.
- No public Skill release or platform directory publication. Remaining acceptance is real-member OAuth and actual tool calls in both platforms, including shared quota and repeat-query accounting.

## Earlier SWA-only evidence (historical) — 2026-09-22

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

## Member portal onboarding — 2026-09-22

Release 7387c1d deployed to SWA (run 35695991079) and Function (98a8cfa1-0760-4a34-9020-222755929a44), both successful and live version verified. Functions/frontend builds passed. All five locales contain three steps, labels and prompts. Live browser verified the Traditional Chinese connection page, canonical URL and all three example cards; clicking the holdings example showed successful copy feedback. This was a signed-out UI check, not a completed member login test. Skill remains 404.

## Manual member installation — 2026-09-22

Release 2f279f0 deployed successfully: SWA run 35698522821; Function deployment 1bff023e-0fef-400a-964a-85a4a63966c2. Clean builds and 15 targeted MCP tests passed (four opt-in Mongo tests skipped). All five generated Skill files passed the skill-creator validator. Live verification used a unique two-minute fixture session for authenticated Skill downloads: all locales passed; anonymous and invalidated sessions returned 401, files contained no fixture credential, and responses were no-store. The fixture was removed. Existing seven-tool MCP/OAuth/quota checks also passed; see member-mcp-install-smoke.json. Browser confirmed signed-out download disabled, canonical commands, working copy feedback and three platform selections. Public Skill URLs remain 404. No installation or OAuth was performed for the actual user; they will follow the page and confirm manually. Official Codex references are linked in the implementation document and page.

## One-prompt installation and theme fix — 2026-09-22

Release eb0f9fc57de5d81e6b487df49004e15911397522 deployed successfully to SWA (run 35700408435) and independent Function (deployment ca017967-3558-4d16-995f-24a549f0f216). Both public app-version endpoints match. Clean builds passed; 16 MCP tests passed and four opt-in Mongo tests skipped. Dark/light command fields and generated prompt/copy verified with local UI fixtures; live browser verified the default quick-install card and collapsed manual settings.

Live backend evidence: member-mcp-quick-install-smoke.json. All five locales provide full Skill and canonical MCP instructions through cookie-free, expiring bootstrap URLs. No member identifiers/session/CSRF secrets appear in guides. Bootstrap tickets cannot authenticate MCP or member downloads. Existing hidden public routes, seven real-data tools, exact quota, deduplication, shared client quota, PKCE code exchange/replay, refresh and revoke passed. Test identities and guide records were cleaned. This is backend verification with isolated fixtures; actual user installation and real ChatGPT/Grok consent remain unverified and are left to the user. No platform publication.

## OAuth recovery — 2026-09-22

Release 1c6e531 deployed to SWA (run 35734763818) and independent Function (deployment 66e10370-8625-4030-999c-03287c9e958d), both successful. Clean Functions/frontend builds passed; 18 MCP tests passed, 4 opt-in Mongo tests skipped. Local UI fixtures verified expired authorization => restart, invalid_login_state => sign-in, temporarily_unavailable => Retry. Production browser verified the expired authorization page displays a safe diagnostic code and fresh-flow instructions without Retry. Live guide/download/credential-isolation and release checks passed; fixtures cleaned (member-mcp-recovery-smoke.json). Original Grok error cause remains unconfirmed; this fixes observed recovery weaknesses, not proof of a reproduced Grok-specific root cause. Existing user connections are not revoked.
