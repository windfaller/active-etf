# Azure Deployment Plan — independent member MCP

Status: Validated for final website discovery update; independent Function deployed and protocol-validated; public Skill remains hidden. User approved the separate Function deployment on 2026-09-22.

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
