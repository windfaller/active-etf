# Azure Deployment Plan

> **Status:** Deployed

Generated: 2026-09-01 11:35:52 Asia/Taipei

---

## 1. Project Overview

**Goal:** Publish the Active ETF caller-side opt-in for the deployed GoGoWinners Auth App `authAction` callback contract.

**Path:** Modify an existing production Azure Static Web Apps deployment. No new Azure resources or infrastructure changes.

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Production |
| Scale | Existing production scale; unchanged |
| Budget | No SKU or resource changes |
| Subscription | Azure subscription 1 (`e4c458d1-80eb-419b-9680-0dc8682a9df4`) |
| Location | East Asia (fixed by existing `tw-active-etf` resource) |
| Compliance | Do not log or persist Firebase ID tokens, email addresses, UIDs, or callback URLs |

The user explicitly approved publishing the existing application. The repository workflow and Azure resource fix the subscription and location; this release does not select or provision a different target.

## 3. Components Detected

| Component | Type | Technology | Path / Resource |
|-----------|------|------------|-----------------|
| Active ETF web | SPA frontend | Vue 3, TypeScript, Vite | `src/web`; Static Web App `active-etf/tw-active-etf` |
| Active ETF API | Integrated API | Azure Functions, TypeScript | `src/functions` and `src/api` |
| Deployment pipeline | CI/CD | GitHub Actions / Azure Static Web Apps | `.github/workflows/azure-static-web-apps-kind-coast-08b07e900.yml` |

## 4. Recipe Selection

**Selected:** Existing CI/CD workflow.

**Rationale:** The application and integrated API already deploy from `main` to the existing Static Web App. This release changes two application files only; no `azd`, Bicep, Terraform, or Azure resource mutation is appropriate.

## 5. Architecture

**Stack:** Existing Azure Static Web Apps SPA with integrated Functions API.

| Component | Azure Service | Change |
|-----------|---------------|--------|
| Vue frontend | Static Web Apps `tw-active-etf` | Add `returnAuthAction=1` to the external sign-in URL |
| Integrated API | Static Web Apps Functions | Rebuild and redeploy unchanged API source |
| Auth App | Separate Static Web App | Already deployed at commit `a849a9a`; no change in this repository |

## 6. Provisioning Limit Checklist

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| New Azure resources | 0 | 0 | Not applicable | Code-only deployment to an existing Static Web App; no quota or capacity change |

**Status:** Capacity checks are not applicable because this release provisions and scales no resources.

## 7. Execution Checklist

### Phase 1: Planning

- [x] Analyze workspace and existing deployment workflow
- [x] Confirm the exact existing subscription, Static Web App, region, repository, and branch
- [x] Confirm no new resource inventory or quota requirement
- [x] Select the existing GitHub Actions CI/CD recipe
- [x] User approved production publication

### Phase 2: Execution

- [x] Add caller-side `returnAuthAction=1` opt-in
- [x] Preserve removal of stale `idToken` and `authAction` from the callback URL
- [x] Add regression tests
- [x] Run unit tests, frontend build, Functions build, and `git diff --check`
- [x] Set status to `Ready for Validation`

### Phase 3: Validation

- [x] Invoke `azure-validate`
- [x] Confirm all validation checks pass
  - [x] Unit tests: 266/266
  - [x] Vue TypeScript and Vite production build
  - [x] Functions TypeScript build
  - [x] Patch integrity and scoped diff review
  - [x] Existing Azure Static Web App target and CI/CD workflow
  - [x] Current production web and anonymous session endpoints
- [x] Set status to `Validated`
- [x] Record validation proof below

### Phase 4: Deployment

- [x] Invoke `azure-deploy`
- [x] Push the scoped release commit to `main`
- [x] Confirm the Static Web Apps workflow succeeds
- [x] Verify production endpoints and caller-side opt-in behavior
- [x] Set status to `Deployed`

## 8. Validation Proof

| Check | Command Run | Result | Timestamp |
|-------|-------------|--------|-----------|
| Unit tests | `npm test` | Pass: 67 files, 266 tests | 2026-09-01 11:34 Asia/Taipei |
| Frontend production build | `npm run build` | Pass: `vue-tsc` and Vite, 1,896 modules | 2026-09-01 11:34 Asia/Taipei |
| Integrated API build | `npm run functions:build` | Pass: TypeScript compilation | 2026-09-01 11:34 Asia/Taipei |
| Patch integrity | `git diff --check` | Pass | 2026-09-01 11:36 Asia/Taipei |
| Azure target | `az staticwebapp list` filtered by repository | Pass: `active-etf/tw-active-etf`, East Asia, `main`, expected repository | 2026-09-01 11:35 Asia/Taipei |
| Existing production web | HTTPS GET `https://active-etf.inthewins.com/` | Pass: HTTP 200 | 2026-09-01 11:36 Asia/Taipei |
| Existing production session boundary | Anonymous GET `https://active-etf.inthewins.com/api/auth/session` | Pass: HTTP 200, unauthenticated and no user payload | 2026-09-01 11:36 Asia/Taipei |
| Resource/RBAC review | Existing code-only Static Web Apps workflow | Not applicable: no provisioning, identity, role, secret, SKU, or region change | 2026-09-01 11:36 Asia/Taipei |

**Validated by:** `azure-validate` workflow

**Validation timestamp:** 2026-09-01 11:36:31 Asia/Taipei

## 8.1 Deployment Proof

| Check | Result | Timestamp |
|-------|--------|-----------|
| Auth App release | Commit `a849a9a` deployed by GitHub Actions run `33466550779` | 2026-09-01 11:33 Asia/Taipei |
| Auth App production | `https://auth-app.gogowinners.me/sign-in` and Azure default hostname returned HTTP 200; deployed bundle contains the opt-in contract | 2026-09-01 11:34 Asia/Taipei |
| Active ETF release | Commit `bcfd052` deployed by GitHub Actions run `33466882205` | 2026-09-01 11:39 Asia/Taipei |
| Pipeline acceptance | Build/deploy, P1 production indexes, and production route/semantic smoke all passed | 2026-09-01 11:39 Asia/Taipei |
| Active ETF production web | `https://active-etf.inthewins.com/` and Azure default hostname returned HTTP 200 | 2026-09-01 11:39 Asia/Taipei |
| Active ETF production session | Anonymous `/api/auth/session` returned HTTP 200 with `authenticated=false` and no user payload | 2026-09-01 11:39 Asia/Taipei |
| Deployed caller contract | Production bundle `assets/index-8j2QVDUl.js` contains `returnAuthAction`, `active_etf_login_success`, and `active_etf_sign_up_success` | 2026-09-01 11:40 Asia/Taipei |

## 9. Functional Verification

- Unit tests: 266/266 passed.
- Frontend production build: passed.
- Functions TypeScript build: passed.
- Patch integrity: `git diff --check` passed.
- Existing unrelated untracked files are outside release scope and remain untouched.

## 10. Files to Modify

| File | Purpose | Status |
|------|---------|--------|
| `.azure/deployment-plan.md` | Release plan and validation/deployment evidence | Added |
| `src/web/auth/authService.ts` | Opt Active ETF into `authAction` callbacks | Complete |
| `tests/web/authService.test.ts` | Preserve callback sanitization and assert opt-in | Complete |

## 11. Rollback

Revert only the scoped Active ETF release commit and let the existing `main` workflow redeploy. The Auth App opt-in contract is additive and does not require rollback when Active ETF omits `returnAuthAction=1`.
