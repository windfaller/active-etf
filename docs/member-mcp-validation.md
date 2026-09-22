# Member MCP validation — 2026-09-22

Status: implemented locally; platform acceptance is incomplete. No production deployment, public directory submission or Git push was performed.

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

1. Confirm the correct stable MCP origin. The prior planning document's `mcp.active-etf.inthewins.com` is a proposal, not an approved or working production endpoint. No default production URL is hardcoded.
2. Restore the browser connection and complete the pending developer-mode decision.
3. Complete real free-member login, OAuth consent and token exchange on both platforms.
4. In each platform, run usage → one holdings query → identical query → usage. Verify successful sourced output and exactly one point charged across retries. Connect the same member on the second platform and verify the shared balance.
5. Check revoke/reconnect and a bounded invalid-input case, then remove or disconnect the temporary test connector as appropriate. Restore ChatGPT developer mode if it was temporarily enabled.
6. Only after those pass, decide the separate stable-host deployment scope. Do not submit either public directory listing during this task.

The temporary HTTPS tunnel was stopped after browser disconnection. The preview service remains on loopback port 7075. Desktop layout was additionally inspected at 1000px width; the 1280px DOM had no horizontal overflow. The local portal labels the endpoint as a test URL. No live production origin is configured.
