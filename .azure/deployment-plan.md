# Azure Deployment Plan — member MCP integration

Status: Deployed — authenticated MCP acceptance blocked by SWA managed Authorization-header rewriting — user explicitly requested migration to Static Web Apps and deployment testing.

## 1. Scope
Integrate free-member MCP and five-language guide into the existing `tw-active-etf` Static Web App and its managed Functions API. No new Azure resource, no SKU changes, no directory publication. Preserve unrelated dirty working-tree changes.

## 2. Existing target
Subscription e4c458d1-80eb-419b-9680-0dc8682a9df4; resource group active-etf; resource tw-active-etf; East Asia. Repository windfaller/active-etf. Confirm live target before deployment. Live HTTP proves chicoo.co redirects to inthewins.com despite a stale PUBLIC_BASE_URL. Configure MCP_PUBLIC_ORIGIN=https://active-etf.inthewins.com; leave legacy PUBLIC_BASE_URL unchanged.

## 3. Architecture
Native Functions HTTP adapter, stateless MCP JSON responses at /api/mcp. MongoDB provides durable auth and atomic member quota. Optional existing Redis provides cache optimization without becoming the quota authority. Existing static frontend hosts guide, consent and OAuth discovery. External Firebase membership is verified as before. No SQLite dependency in the deployed execution path.

## 4. Recipe
Existing-resource deployment through the existing GitHub Actions SWA workflow; Azure CLI sets the explicit MCP canonical origin. Build an isolated release snapshot from Git HEAD plus only this task's changes; commit only the isolated task changes while preserving unrelated primary working files. Inspect deployment method and API runtime before uploading.

## 5. Implementation
- [x] Native HTTP application and async persistent storage
- [x] Functions routes, OAuth discovery and same-origin frontend
- [x] Atomic MongoDB quota/auth integration tests
- [x] Isolated release build and regression checks

## 6. Validation and deployment
- [x] Local build and existing/new tests
- [x] Real database adapter test with uniquely named disposable test records
- [x] Azure context and existing configuration presence (no secret output)
- [x] Record validation proof; then execute deployment
- [ ] Verify deployed version, discovery, protocol, authentication and quota
- [ ] Attempt target-platform verification; record any user-login gates distinctly

## 7. Validation Proof
2026-09-22: Isolated release npm ci, Functions TypeScript build, Vue/Vite build and 286 regression tests passed (4 opt-in Mongo tests skipped there). Primary suite with real Mongo integration: 291 tests passed. Existing Azure Free resource and remote main c3de854 confirmed. No provisioning or Bicep change. Local Functions Core Tools did not open its listener; deployed Functions verification is required before acceptance. Previous production app-version: c3de85473647f3062d35fada1886e616682ab6f9.

## 8. Rollback
Preserve the prior deployed artifact/version information. No destructive database migration: dedicated MCP collections/indexes only. Restore previous application deployment if existing site checks regress.

## Live result
GitHub Actions 35688039014 succeeded; live version 502601180519a451491dc8a242f3319d65c186a0. Existing production checks and five-language pages passed. OAuth token exchange passed using a short-lived fixture code, but public MCP calls return 401 while the same token passes the same build directly. See docs/member-mcp-validation.md. Separate Function hosting is the proposed next change, not yet provisioned.
