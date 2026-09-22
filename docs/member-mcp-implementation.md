# Current deployment

The public website stays on Azure Static Web Apps. Standard MCP is hosted separately at https://active-etf-mcp.inthewins.com/api/mcp because SWA managed Functions overwrite Authorization. The standalone Function serves its OAuth endpoints and consent UI on the same origin. Public Skill pages/downloads are disabled by default (`VITE_MCP_SKILL_PUBLIC` must remain unset/false until acceptance). The main-site entry is removed.

## Repeatable independent deployment

1. Build a clean Git snapshot: `npm ci`, `npm run functions:build`; run tests.
2. Build the consent UI with `VITE_AGENT_SITE_ORIGIN` and `VITE_MCP_PUBLIC_ORIGIN` both set to `https://active-etf-mcp.inthewins.com`, plus `GITHUB_SHA` set to the release commit.
3. Run `node scripts/package-member-mcp.mjs <fresh-output-directory>` and install production dependencies there with `npm ci --omit=dev --ignore-scripts`.
4. Apply `infra/member-mcp/main.bicep` only after validate/what-if. On existing deployments, preserve runtime app settings: the base template does not contain MongoDB/Redis credentials; re-run the configuration script after applying infrastructure.
5. Run `python3 scripts/configure-member-mcp.py` to copy only the necessary existing SWA connection settings to the Function, without logging values.
6. ZIP the output directory contents and upload with `az functionapp deployment source config-zip --resource-group active-etf --name active-etf-member-mcp --src <zip> --build-remote false`.
7. Verify live app-version, protocol/auth/quota and Skill 404s. SWA CI deploys the website only; it does not automatically update this independent Function.

# Free member MCP runtime

## Runtime and routes

The market frontend remains on Static Web App `tw-active-etf`. MCP and OAuth run on the independent Flex Consumption Function `active-etf-member-mcp`, in resource group `active-etf`. SWA CI and the standalone Function package are separate deployments.

The canonical MCP/OAuth origin is `https://active-etf-mcp.inthewins.com`, with MCP at `/api/mcp` and the member test portal at `/zh-TW/mcp/connect`. The market website remains `https://active-etf.inthewins.com`. `MCP_PUBLIC_ORIGIN` explicitly selects the MCP origin and must not be inferred from Host headers or the market website PUBLIC_BASE_URL. Existing clients must use the new MCP URL and reconnect through OAuth; tokens are resource-bound.

- MCP: `/api/mcp`
- Runtime config: `/api/agent/config`
- Health: `/api/mcp-health`
- OAuth: `/api/oauth/{register,authorize,token,revoke}`
- Browser session/consent: `/api/agent/*`
- Public discovery: `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/api/mcp`
- Challenge-advertised discovery: `/api/.well-known/oauth-protected-resource/mcp`
- Guide, Skill, and consent UI: `/{en|zh-TW|zh-CN|ja|ko}/mcp`, `/mcp/skill`, `/mcp/connect`

The SDK transport is stateless Streamable HTTP with JSON responses. It does not require a persistent SSE connection. Research calls in the Functions adapter have a 15-second provider budget; MongoDB ledger commands and CAS retries are bounded. Timed-out research reads cannot proceed to the charging step.

## Persistence and quota

Existing `MONGODB_URI` and `MONGODB_DB_NAME` are reused. Dedicated `member_mcp_records` and `member_mcp_usage` collections have TTL indexes. Every free member gets 20 research points per Taipei day, shared across all clients.

| Tool | Points |
| --- | ---: |
| search_market_entities | 0 |
| get_my_plan_usage | 0 |
| get_etf_snapshot | 1 |
| get_etf_changes | 1 |
| compare_etfs | 2 |
| get_stock_context | 2 |
| build_research_brief | 3 |

A versioned per-member/day MongoDB document atomically reserves and charges quota using compare-and-swap. This works across Function instances without requiring replica-set transactions. Two pending operations and 20 calls/minute are allowed. Empty or failed reads do not charge. Matching normalized arguments return the same member-specific snapshot within ten minutes without another charge. Cache results are stored separately so large holdings never inflate the ledger document. Research history is bounded to 30 days; comparisons to three supported Taiwan-listed ETFs.

Existing Redis is optional and caches public research payloads for five minutes under `active-etf:mcp:v1:research:`. Authorization and authoritative quota always remain in MongoDB; a Redis outage falls back to the provider and cannot bypass either. Anonymous OAuth abuse controls currently use a conservative shared ingress bucket; tune trusted client-IP handling before a broad public launch. Elasticsearch is not needed for this release.

The old `store.ts` SQLite adapter and `mcp:start` are local prototype/test utilities only. They are not imported by the Functions execution path. Local SQLite requires Node 24; the independent Function uses Node 24 and MongoDB.

## OAuth and membership

The existing GoGoWinners/Firebase sign-in is verified server-side. One-time login state and an HttpOnly cookie bind the callback to its initiating browser. Session mutations require the canonical Origin and CSRF token. A named client and exact registered return origin are displayed before consent.

OAuth uses mandatory S256 PKCE, resource-bound opaque access tokens, one-use codes, rotating refresh tokens, replay-family revocation, and user-triggered grant revocation. Access tokens last one hour; refresh tokens last 30 days. AI clients receive dedicated access tokens, never the Firebase login token. Secrets are hashed for lookup; tokens and callback credentials must not be logged.

`MCP_BETA_MEMBER_IDS` optionally restricts use to specified Firebase subjects. No test identity verifier or fixture login bypass exists in the production adapter. OAuth registration does not by itself establish a member identity.

## Build and verification

- `npm run functions:build`
- `npm run web:build`
- `npm run test:mcp`
- `MCP_INTEGRATION=1 npm run test:mcp` runs real MongoDB checks against fresh, uniquely named temporary collections, then removes only those test collections.

`src/mcp/handler.ts` is the shared Web Request/Response implementation. `src/api/memberMcp.ts` adapts Azure Functions HTTP and cookies. `src/mcp/server.ts` is the local Express adapter. Public OAuth discovery is generated with the same canonical origin during the frontend build. Its correctness is checked through the deployed gateway.

The five-language localization covers the new portal, Skill guide and authorization UI, not every legacy market/legal page. Skills are generated at `/skills/{locale}/active-etf-research/SKILL.md`; an English source artifact is in `skills/active-etf-research`. A Skill does not automatically authorize MCP.

See `member-mcp-validation.md` for observed deployment and platform acceptance evidence. No public connector-directory submission is authorized by this deployment task.

## Member portal onboarding

The five-language `/mcp/connect` page includes a three-step connection guide, a copyable canonical MCP URL, ChatGPT/Grok setup notes, and copyable usage (0 points), holdings (1 point) and comparison (2 points) prompts. The guide is also visible before sign-in so members can understand the flow, but it is omitted during an active OAuth consent request. Prompts are pasted into the connected AI chat; the portal does not itself execute research tools. Copying does not consume quota. Signed-in members see the appropriate next-step message instead of the signed-out notice. Public Skill pages and downloads remain hidden.
