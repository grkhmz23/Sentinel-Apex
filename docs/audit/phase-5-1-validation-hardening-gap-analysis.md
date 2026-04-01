# Phase 5.1 Validation Hardening Gap Analysis

Date: 2026-03-31
Repo: `/workspaces/Sentinel-Apex`

## Current Validation Entrypoints

- Root package scripts:
  - `pnpm build`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
- Targeted package validation is commonly run through `pnpm --filter <workspace> <task>`.
- `Makefile` mirrors root build/typecheck/lint/test targets.
- A root `vitest.config.ts` exists, but before this phase it only represented a subset of the repo.

## Current Reliability Gaps

- Root validation existed, but it was not yet a clearly documented contract for local development, CI, and release readiness.
- `turbo.json` used narrow `inputs` such as `src/**` and `test/**`, which missed real app/build/config surfaces like:
  - `app/**` in the Next dashboard
  - `scripts/**`
  - package-local config files
  - root validation config changes
- `@sentinel-apex/db` lacked standard `lint` and `test` scripts, which made root orchestration less uniform than the rest of the workspace.
- Root lint was not trustworthy because it failed on at least one real import-order defect while also producing recurring `decimal.js` false-positive warnings.
- The root Vitest workspace file implied broader coverage than it actually provided.
- The repo had no explicit release-readiness or monorepo-validation runbooks.

## Environment-Specific vs Repo-Specific Issues

Repo-specific issues:

- overly narrow Turbo inputs
- missing package validation scripts
- incomplete root Vitest workspace coverage
- recurring ESLint noise around `decimal.js`
- no canonical `validate` / `validate:ci` / `release:check` entrypoints

Environment-specific issues:

- sandbox `listen EPERM` restrictions still affect direct long-running server binding attempts
- long-running runtime/API tests are slower in constrained environments
- live connector execution validation remains intentionally out of scope in this repo state

## Target Root Validation Model

Canonical source-of-truth commands:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm validate`
- `pnpm validate:ci`
- `pnpm release:check`

Contract:

- package-level scripts remain the unit of work
- Turbo orchestrates repo-wide validation deterministically
- root commands are the documented merge/release gates
- targeted validation remains acceptable for iteration, not for release readiness
- root validation truth is documented alongside known environment limits

## Implementation Plan

1. Harden `turbo.json` so cache invalidation and task inputs match the real repo layout.
2. Standardize missing package scripts so core workspaces participate consistently in root orchestration.
3. Fix real root lint failures and reduce recurring repo-owned warning noise where it is clearly misleading.
4. Make the root Vitest workspace truthful across apps/packages.
5. Add canonical root entrypoints for local validation, CI validation, and release readiness.
6. Update `Makefile`, `README`, and runbooks so the same contract is described everywhere.
7. Run full root validation and document the exact pass/fail status honestly.
