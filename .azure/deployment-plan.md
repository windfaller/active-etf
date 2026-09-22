# Azure Deployment Plan — independent member MCP

Status: Validated — OAuth recovery guidance and native-client installation rules.

## Scope and authorization
Keep the market website on existing Free SWA tw-active-etf. Deploy the existing MCP handler to a new independent Azure Function to preserve standard Authorization. Reuse existing MongoDB and optional Redis. User now requires Skill information hidden until acceptance; remove public navigation and prevent direct access to all five public Skill pages/downloads. No platform directory publication. Preserve unrelated local changes.

## Azure context
Existing subscription e4c458d1-80eb-419b-9680-0dc8682a9df4; resource group active-etf; prefer East Asia if Function plan supported. New consumption-based Function, storage and required hosting resources only. No always-ready capacity. Confirm available regions/SKUs via CLI before provisioning.

## Recipe
Azure CLI, with portable deployment/package scripts. First deploy hidden public pages through existing SWA CI. Then independently package the native MCP Functions entry point plus private OAuth consent UI, excluding existing timers and market API registration. All OAuth endpoints and cookies share the independent Function origin. Reuse original MongoDB scope for quotas.

## Acceptance
- Build and regression tests; source isolation before deploy.
- SWA public Skill routes and downloads unavailable; navigation removed.
- Live independent Function discovery, standard bearer authentication, seven tools, real data and exact-once quota.
- OAuth code/refresh/revoke verification separated from real member login and ChatGPT/Grok acceptance.
- Keep Skill publication disabled until acceptance is explicitly recorded.

## Validation Proof
Phase A: isolated release web build and Functions build passed; 12 MCP protocol tests passed, four opt-in database tests skipped. Generated-output assertions passed: all five Skill routes return configured 404, Skill files/downloads omitted and Skill links absent. Existing deployment context and scope unchanged. Phase B: official TypeScript HTTP template downloaded through azd into an isolated temporary directory; existing resource group bound as existing. Bicep compilation succeeded (only template conditional-null warnings for disabled VNet branches). ARM validation Succeeded; what-if Succeeded with only new Function/storage/identity/monitoring resources, existing SWA and Logic App Ignore. Two template role assignments use the new identity whose ID is resolved during deployment; statically verified Blob Data Owner on the new storage and Metrics Publisher on new Insights only. Functions build passed; 14 protocol/isolation tests passed, four opt-in Mongo tests skipped. East Asia supports Node 24; 512 MB, maximum 2 instances, no always-ready capacity. Subscription Enabled; existing resource group location southeastasia preserved, resources deploy eastasia. Prior SWA deployment 5026011 succeeded but authenticated MCP requests failed due to managed gateway Authorization rewriting.

## Rollback
Independent Function deployment is additive; retain existing main-site code and settings. Revert new code if existing site regresses. No destructive database migration or removal of user resources.

## Live proof
Independent Function infra provisioning Succeeded; deployment dcd5ff9a-0881-46e1-af15-ec544ef1df01 succeeded. All seven tools passed real HTTP Bearer calls, real provider output, 9-point exact accounting, duplicate query zero charge, second-client shared balance, refresh/revoke. Live storage role confirmed; disabled storage public blobs/shared keys confirmed. Main site 20 Skill route/download variants returned 404. Real user identity/ChatGPT/Grok acceptance not completed; no Skill publication.

Final website update: isolated frontend build passed; generated discovery redirect points to the independent Function and Skill 404 gate remains enabled.

## User-requested pause — 2026-09-22
User requested pause before going out. Independent serverless MCP core tests passed and public Skill remains hidden. Final SWA synchronization run 35690619468 and final Function package upload were already submitted before the pause. Do not start additional work; on explicit resume, first inspect these in-flight deployment outcomes, verify version 18c9792 and Skill 404s, then continue real-member/platform acceptance. No public Skill release or directory publication authorized before acceptance.

## Explicit resume — 2026-09-22
User requested continuation. Final SWA run 35690619468 succeeded and both live origins report release 18c9792. All 55 version, localized connection, hidden Skill and discovery redirect checks passed; evidence in docs/member-mcp-resume-checks.json. Edge verified the member portal and correct GoGoWinners callback, but disconnected during the Google login attempt before any authenticated callback. ChatGPT developer mode is still off; action-time confirmation is pending. Grok connector endpoint and real tool calls remain unverified. Resume with browser reconnection, member login and private connector acceptance; do not publish Skill or platform listings.

## Canonical MCP domain update — 2026-09-22
User configured and requested https://active-etf-mcp.inthewins.com. Scope: existing Function and SWA MCP_PUBLIC_ORIGIN, canonical frontend links/discovery, generated Skill instructions and deployment documentation. Keep Skill hidden; no infrastructure/RBAC changes. Validation: existing subscription Enabled, Function Running, custom hostname bound and HTTPS returns 200; initial metadata still advertised Azure hostname. Build clean release excluding unrelated workspace edits, validate protocol tests and generated pages before deploying. Infrastructure/template/what-if steps are not applicable to this app-package/settings-only update; original validated infrastructure and roles remain unchanged.

Validation Proof (custom domain, 2026-09-22): npm ci, npm run functions:build, npm run test:mcp (14 passed, 4 opt-in Mongo skipped), VITE_AGENT_SITE_ORIGIN/VITE_MCP_PUBLIC_ORIGIN custom-domain web build passed. Generated five-locale canonical links, OAuth issuer, absence of old hostname in JS and Skill omission asserted. Same subscription/resource group/Function, no RBAC or infrastructure changes; app settings mutation is limited to MCP_PUBLIC_ORIGIN. Azure Deploy application-only recipe follows this validated proof.

Custom-domain deployment proof: SWA run 35695044832 succeeded; Function deployment 3040c5ce-cf7a-4023-874e-bb7de496116b succeeded. Both serve 0d74b6f. 63 public/callback checks plus all seven authenticated MCP tools, PKCE/replay, shared quota/deduplication and refresh/revoke passed on the custom domain. Isolated test fixtures cleaned; no real user quota used. No infrastructure or role mutation. See docs/member-mcp-custom-domain-{checks,smoke}.json.

## Member portal onboarding — 2026-09-22
User requested next steps and basic examples on the member page. Add five-language connection instructions, endpoint copy, ChatGPT/Grok help and three copyable prompts; correct signed-in heading. Hide onboarding during active OAuth consent. Validation proof: clean snapshot npm ci, functions:build and web:build passed; five localized connect pages generated and Skill files absent; git diff --check passed. Existing custom domain, settings, RBAC and infrastructure unchanged; no infrastructure provisioning or token/quota changes. Apply Azure Deploy application-only recipe to existing SWA and Function.

Onboarding deployment proof: SWA run 35695991079 succeeded; Function deployment 98a8cfa1-0760-4a34-9020-222755929a44 succeeded. Both live origins serve 7387c1d. Browser verified Traditional Chinese three-step guide, canonical URL, three example cards and successful copy feedback. Five locale copy structures checked; Skill URL still 404. Browser used signed-out state; real authenticated account/ChatGPT/Grok acceptance remains separate and pending.

## Manual Skill installation — 2026-09-22
User requests implementation and then manual installation/acceptance by the user. Scope: five-language agent selector, Codex Skill placement and native MCP/OAuth commands, web connector route, zero-point verification prompt and clearly self-reported checklist. GET /api/agent/skill is member-session protected; no tokens embedded. Public Skill URLs remain 404. Validation: clean npm ci/functions:build/web:build passed; 15 MCP tests passed, 4 opt-in Mongo skipped. New download test verifies anonymous denial, five locales, no-store/noindex, no embedded session secret, no quota cost, invalid locale and post-logout denial. All five generated Skill files passed skill-creator quick_validate.py. Codex commands checked against installed CLI help and official docs. Existing subscription/resources/roles/settings unchanged; application-only Azure Deploy recipe. Do not install into the user agent or complete their OAuth on their behalf; user will follow the deployed page.

Manual installation deployment proof: SWA run 35698522821 succeeded; Function deployment 1bff023e-0fef-400a-964a-85a4a63966c2 succeeded, release 2f279f0. Live member Skill download tests passed for all five locales, anonymous/invalidated sessions rejected and fixture records cleaned. Existing seven-tool, OAuth/refresh/revoke and shared quota tests passed. Browser verified disabled signed-out download, Codex commands and copy feedback, ChatGPT/Grok switching and unchecked manual checklist. Public Skill still hidden. User installation and OAuth intentionally left to the user.

## One-prompt bootstrap and theme contrast — 2026-09-22
User requested moomoo-style install prompt and readable dark/light colors. Read the referenced moomoo install document as design reference only. Implement member+CSRF-protected POST /api/agent/install-link issuing a 30-minute instruction-only URL; its GET guide includes the Skill payload and native MCP/OAuth setup instructions, with no user identifiers or OAuth secrets. Agent can fetch it without browser cookies; it cannot grant member/API access. Manual controls collapsed by default, one main copy action in five locales. Theme surface/code/text variables explicitly paired. Validation proof: clean dependency install, Functions and frontend builds passed; 16 MCP tests passed, 4 opt-in Mongo skipped. New tests cover anonymous/CSRF rejection, bootstrap content, TTL expiry, zero quota, and rejection when used as MCP/session credentials. Local UI fixture verified generated prompt/copy, collapsed advanced controls and dark/light screenshots with readable command fields. No actual user installation/OAuth performed. Infrastructure/settings/RBAC unchanged; existing Azure application deployment recipe.

One-prompt deployment proof: SWA run 35700408435 succeeded; Function deployment ca017967-3558-4d16-995f-24a549f0f216 succeeded. Both origins serve eb0f9fc57de5d81e6b487df49004e15911397522. Live five-language cookie-free bootstrap guides, ticket isolation, existing member downloads, all seven MCP tools, quota/deduplication, PKCE and refresh/revoke passed; isolated fixtures cleaned. Browser verified live quick-install card and collapsed advanced controls. See docs/member-mcp-quick-install-smoke.json. Real user installation/OAuth remains for user acceptance.

## OAuth recovery hardening — 2026-09-22
User reports Grok's first authorization page repeatedly showing Retry; exact upstream cause is unconfirmed. Scope: distinguish unusable authorization links, invalid browser login state and transient connection failures in five languages; cap portal fetch waits at 20 seconds; display only allowlisted diagnostic codes; disable consent while an error is present. Skill/bootstrap instructions require native OAuth discovery and a fresh client-owned URL, never fabricated URLs or repeated refresh of failed links. No OAuth security validation weakened, no credential or infra/settings/RBAC changes.

Validation proof: isolated HEAD snapshot plus only these changes, npm ci, functions:build, web:build passed; test:mcp 18 passed and 4 opt-in Mongo skipped. Browser fixture verified expired authorization has restart instructions without Retry; invalid login state offers sign-in; transient failure retains Retry. Azure account e4c458d1-80eb-419b-9680-0dc8682a9df4 Enabled and existing Function in East Asia confirmed. Apply existing Azure CLI application-only deployment recipe; original infrastructure/template/role proof remains applicable. Real Grok failure not reproduced; do not claim its cause is resolved.
