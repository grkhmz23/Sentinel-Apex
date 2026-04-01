# Current State Audit

Date: 2026-04-01
Repo: `/workspaces/Sentinel-Apex`

## What Exists

- Monorepo tooling: `pnpm`, Turborepo, TypeScript, ESLint, Prettier, Vitest.
- Monorepo validation contract: canonical root `build`, `typecheck`, `lint`, `test`, `validate`, `validate:ci`, and `release:check` entrypoints now exist and are documented.
- Apps: `apps/api`, `apps/runtime-worker`, `apps/ops-dashboard`.
- Packages: `allocator`, `carry`, `config`, `db`, `domain`, `execution`, `observability`, `risk-engine`, `runtime`, `shared`, `strategy-engine`, `treasury`, `venue-adapters`.
- Docs: `docs/prd`, `docs/architecture`, `docs/adr`, `docs/risk`, `docs/strategy`, `docs/audit`.
- Infra: `docker-compose.yml`, `infra/docker/Dockerfile.api`, `infra/docker/docker-compose.local-db.yml`.
- CI entrypoint: `.github/workflows/validation.yml` now runs the canonical `pnpm validate:ci` contract.

## What Works

- Core domain, carry, risk, execution, venue-adapter, strategy-engine, runtime, and API packages build and test.
- `packages/db` now has:
  - committed SQL migrations `0001_phase1_runtime_foundation.sql`, `0002_phase1_5_operational_hardening.sql`, `0003_phase1_6_worker_and_recovery.sql`, `0004_phase1_7_recovery_lifecycle.sql`, and `0005_phase1_8_mismatch_remediation_actions.sql`
  - typed Drizzle schema for runtime facts and current projections
  - PostgreSQL and PGlite connection support
  - executable migration tooling
- `packages/runtime` now provides:
  - explicit bootstrap and shutdown semantics
  - persisted runtime lifecycle state
  - persisted worker lifecycle and scheduler state
  - durable runtime commands for one-shot cycles and projection rebuilds
  - durable mismatch and recovery event history
  - formal mismatch lifecycle state:
    - `open`
    - `acknowledged`
    - `recovering`
    - `resolved`
    - `verified`
    - `reopened`
  - explicit operator lifecycle actions for acknowledge, recover, resolve, verify, and reopen
  - mismatch-scoped remediation attempts for `rebuild_projections` and `run_cycle`
  - durable mismatch -> remediation attempt -> command -> recovery event linkage
  - remediation history, latest remediation, actionable-state, and in-flight query support
  - mismatch detail, summary counts, and recovery outcome query support
  - explicit reconciliation runs with durable run metadata
  - durable reconciliation findings linked to mismatches where integrity issues are detected
  - reconciliation-driven mismatch creation and update paths
  - reconciliation summary, finding inspection, and run history query surfaces
  - deterministic projection rebuild from persisted records
  - startup restoration of adapter state from persisted fills
  - operator-safe pause, resume, cycle-run, projection-rebuild, and reconciliation-run command controls
  - runtime-integrated treasury evaluation with explicit `run_treasury_evaluation` command support
  - runtime-integrated allocator evaluation with explicit `run_allocator_evaluation` command support
  - runtime-integrated carry evaluation with explicit `run_carry_evaluation` command support
  - runtime-integrated carry execution with explicit `execute_carry_action` command support
  - durable carry action lifecycle, carry execution history, carry execution-step persistence, carry venue readiness snapshots, and rebalance-to-carry downstream action linkage
  - durable treasury action lifecycle, treasury execution history, treasury proposal linkage for rebalance-created budget actions, and treasury execution-kind visibility across venue execution vs budget-state application
  - backend-native rebalance execution graph queries spanning proposal, command, rebalance execution, downstream carry action/execution, downstream treasury action/execution when persisted, and ordered operator timeline detail
  - durable rebalance bundle coordination with proposal-scoped bundle records, bundle rollups, partial-failure classification, and operator intervention recommendations
  - durable bundle recovery action history with proposal-linked child retry eligibility, command linkage, and explicit worker-driven completion / failure outcomes
  - durable bundle manual-resolution history with partial-progress inspection, operator-authored closure decisions, and escalation state
  - durable bundle escalation workflow with ownership, acknowledgement, review state, and close history
  - backend-native escalations queue with cross-bundle ownership, due-state, latest-activity, and summary rollups
  - generic venue connector inventory and append-only venue truth snapshot history across simulated and real read-only connectors
  - richer venue-truth depth with typed account-state, balance-state, capacity-state, exposure-state, execution-reference state, derivative-account metadata, derivative/order coverage, completeness, coverage, source metadata, and venue truth profiles
  - explicit venue-truth reconciliation coverage for missing, stale, unavailable, partial, and execution-reference mismatch states on real connector snapshots, including derivative-aware partial posture where supported
- `packages/allocator` now provides:
  - Sentinel sleeve registry for Carry and Treasury
  - deterministic portfolio-level budgeting policy
  - explicit regime/pressure interpretation
  - allocator rationale, constraints, and rebalance recommendation generation
  - deterministic rebalance proposal planning from allocator targets
- `packages/treasury` now provides:
  - explicit treasury policy models
  - reserve floor enforcement
  - idle-capital and surplus-capital detection
  - venue concentration checks
  - deterministic treasury recommendation generation
  - treasury execution intent planning with explicit blocked reasons
  - treasury execution-time effect modeling
- `packages/venue-adapters` now also provides treasury-specific venue abstractions and explicit simulated treasury adapters.
- `packages/venue-adapters` now also provides carry capability metadata and explicit simulated carry execution capability reporting.
- `packages/venue-adapters` now also provides a generic venue-truth contract plus an explicit real read-only Solana JSON-RPC adapter with partial derivative-account metadata and reference-only order context where generic RPC can support it honestly.
- `packages/db` now also persists treasury state in:
  - `treasury_runs`
  - `treasury_venue_snapshots`
  - `treasury_actions`
  - `treasury_current`
- `packages/db` now also persists append-only treasury execution history in:
  - `treasury_action_executions`
- `packages/db` now also persists allocator state in:
  - `allocator_runs`
  - `allocator_sleeve_targets`
  - `allocator_recommendations`
  - `allocator_current`
- `packages/db` now also persists allocator rebalance workflow state in:
  - `allocator_rebalance_proposals`
  - `allocator_rebalance_proposal_intents`
  - `allocator_rebalance_executions`
  - `allocator_rebalance_bundles`
  - `allocator_rebalance_bundle_recovery_actions`
  - `allocator_rebalance_bundle_resolution_actions`
  - `allocator_rebalance_bundle_escalations`
  - `allocator_rebalance_bundle_escalation_events`
  - `allocator_rebalance_current`
- `packages/db` now also persists carry controlled-execution state in:
  - `carry_venue_snapshots`
  - `carry_actions`
  - `carry_action_order_intents`
  - `carry_action_executions`
  - `carry_execution_steps`
- `packages/db` now also persists generic venue-truth history in:
  - `venue_connector_snapshots`
- `apps/api` serves portfolio, risk, orders, positions, opportunities, events, runtime status, worker status, mismatch history, and control surfaces from persisted runtime-backed state.
- `apps/api` now also serves treasury summary, allocations, policy, recommendations, action detail, execution detail, venue readiness/detail, treasury approval, and explicit treasury execution queueing.
- `apps/api` now also serves action-scoped treasury execution history and richer treasury execution detail with proposal linkage where available.
- `apps/api` now also serves allocator summary, latest sleeve targets, decision history/detail, run history, and explicit allocator evaluation queueing.
- `apps/api` now also serves rebalance proposal list/detail, decision-linked proposals, and rebalance approval/rejection actions.
- `apps/api` now also serves proposal-scoped rebalance execution graph detail and rebalance timeline detail.
- `apps/api` now also serves rebalance bundle list/detail, proposal-to-bundle linkage, and bundle timeline detail.
- `apps/api` now also serves bundle recovery candidates, bundle recovery action history/detail, and explicit bundle recovery request mutations.
- `apps/api` now also serves bundle manual-resolution options, manual-resolution history/detail, and explicit operator closure mutations.
- `apps/api` now also serves bundle escalation detail/history plus explicit assignment, acknowledgement, review, and close mutations.
- `apps/api` now also serves escalations queue, queue summary counts, and an authenticated mine query for cross-bundle operator triage.
- `apps/api` now also serves generic venue inventory, readiness, summary counts, truth-depth summary, richer venue detail, and snapshot history.
- `apps/api` now also serves carry recommendations/actions, carry action detail, action-scoped carry execution history, dedicated carry execution detail, carry venue capability state, explicit carry evaluation queueing, and carry approval-driven execution queueing.
- `apps/runtime-worker` executes scheduled cycles, processes runtime commands, and persists scheduler/recovery visibility independently of the API process.
- `apps/ops-dashboard` now provides an internal Next.js operator UI for overview, mismatch inspection, reconciliation visibility, recovery and command inspection, and safe action dispatch through the existing runtime API.
- `apps/ops-dashboard` now also provides:
  - server-side sign-in and sign-out
  - durable operator sessions
  - role-aware action gating for `viewer`, `operator`, and `admin`
  - signed operator propagation from the dashboard proxy into the API
  - Atlas Treasury overview visibility and a dedicated treasury page
  - treasury recommendation readiness, blocked reasons, approval controls, execution controls, and execution history
  - treasury action detail, dedicated treasury execution history/detail, and venue readiness drill-through views
  - a first Sentinel allocator page with current-vs-target sleeve budgets, rationale visibility, decision history, and decision detail
  - rebalance proposal visibility and proposal detail with approval controls and execution outcome state
  - backend-native rebalance proposal execution graph drill-through with grouped downstream carry/treasury sections and ordered workflow timeline
  - bundle-level rebalance coordination drill-through with durable status, recovery recommendation, and downstream child rollups
  - bundle recovery candidates with backend-computed eligibility and blocked reasons
  - durable bundle recovery history linked to explicit command outcomes
  - inspect-first partial-progress bundle detail with retryable and non-retryable child breakdown
  - explicit bundle manual-resolution options and durable resolution history
  - escalation ownership, assignee, due-at, and review-status visibility on bundle detail
  - durable escalation handoff and follow-up history
  - an escalations queue page with cross-bundle filters, ownership visibility, due-state badges, and safe queue-level triage actions
  - a generic venues inventory page with real-vs-simulated, read-only-vs-execution-capable, freshness, truth-depth summary, and snapshot-history drill-through
  - per-venue truth detail with completeness, coverage, account state, balances, exposure-like state, and recent reference visibility
  - a first controlled-execution carry page with recommendation/actionability visibility, blocked reasons, execution history, venue readiness, and carry action drill-through
  - dedicated carry execution list/detail drill-through with step-level outcomes and timeline visibility
- Root validation ergonomics now also provide:
  - deterministic Turbo inputs based on real package/app files instead of `src/**`-only assumptions
  - standard `lint` and `test` scripts on `packages/db`
  - a truthful root Vitest workspace definition spanning the real apps/packages
  - runbooks for monorepo validation and release readiness
- `apps/api` now enforces backend operator authorization for sensitive runtime and control mutations in addition to API-key authentication.
- `packages/db` now persists internal operators and dashboard sessions in `ops_operators` and `ops_operator_sessions`.
- Existing runtime actor/audit fields are now populated from authenticated operator identity for dashboard-driven actions instead of client-supplied placeholders.
- Local/dev Postgres workflow now exists through `pnpm db:start`, `pnpm db:health`, `pnpm db:migrate`, `pnpm db:reset`, and `pnpm db:stop`.
- Treasury venue readiness now exposes explicit simulated-vs-real, read-only-vs-execution-capable, onboarding state, and missing-prerequisite metadata to operators.
- Generic venue truth now also exposes canonical connector type, sleeve applicability, truth source, snapshot freshness, health, last successful snapshot time, completeness, coverage, and typed account/balance/exposure/reference depth where supported.
- Deterministic carry simulation is now materially more credible:
  - funding opportunities use mark price instead of placeholder price `1`
  - minimum funding-rate threshold is enforced
  - strategy sizing respects projected gross exposure and open-position constraints

## What Is Partial

- Runtime projection updates still happen inline inside the runtime execution path rather than a separate projector process.
- The runtime is still an internal Phase 1 paper-trading service, but scheduled execution now runs in a dedicated worker instead of the API process.
- Local/dev Postgres workflow is now first-class, but production deployment wiring, secret management, and hosted operational automation are still out of scope.
- The API remains the source of truth for control-plane logic. The first operator UI now exists, but it is intentionally a thin internal dashboard rather than a broad admin suite.
- Internal auth is now intentionally minimal and credentials-based. It is appropriate for current internal use, but it is not yet external SSO or broader identity management.

## What Is Broken

- Reconciliation now compares persisted internal state against durable projections, runtime command outcomes, venue order/position state available through the existing adapters, and generic plus derivative-aware venue-truth freshness, health, completeness, coverage, and recent-reference depth for configured real connectors. It is real and auditable, but still bounded to the state the current repo can reconcile with confidence.
- API startup in this sandbox still cannot bind to `0.0.0.0` because of environment `listen EPERM` restrictions rather than an application defect.

## What Is Missing

- Broader operator workflows beyond treasury drill-through, especially command detail and richer recovery navigation.
- Full production-grade live carry connectors and venue onboarding beyond explicit simulated/read-only posture.
- Broad real execution-capable venue connectors beyond the single read-only truth path.
- Venue-native liquidity or capacity truth for the current generic Solana RPC connector.
- Decoded Drift-native authority, subaccount, derivative position, and health semantics beyond the raw program-account metadata the current runtime can capture.
- Canonical venue-native open-order inventory beyond the reference-only recent-signature context the current runtime can capture today.
- Operator management workflows beyond bootstrap and direct DB-backed setup.
- Production-grade live venue integration.
- Live approval for any Phase 5.x real connector.
- Backtest foundations.
- Autonomous allocator-to-sleeve routing beyond explicit operator-approved budget-state workflows.
- Autonomous carry deployment directly from allocator evaluation.
- Full venue-native treasury detail for flows that are only budget-state application; those flows are now explicit treasury action/execution records when persisted, but they are still not connector-native treasury venue executions.
- Generic proposal replay, cancel tooling, and autonomous healing; Phases 4.7 through 5.0 add explicit child-scoped recovery, operator closure, escalation handoff, and escalation triage semantics, not autonomous orchestration.
- Fully eliminating toolchain-origin warnings from Vitest/Vite CJS compatibility messages remains out of scope for this pass; the canonical validation commands still complete successfully.

## Validation Results

Commands run against the real repo state:

- `pnpm install`
- `pnpm install --frozen-lockfile`
- `pnpm validate:ci`
- `pnpm test`
- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/runtime typecheck`
- `pnpm --filter @sentinel-apex/runtime lint`

Targeted validation also run during implementation:

- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/api build`
- `pnpm --filter @sentinel-apex/carry test`
- `pnpm --filter @sentinel-apex/strategy-engine test`
- `pnpm --filter @sentinel-apex/runtime test`
- `pnpm --filter @sentinel-apex/api test`
- `pnpm --filter @sentinel-apex/db build`
- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/runtime typecheck`
- `pnpm --filter @sentinel-apex/runtime test`
- `pnpm --filter @sentinel-apex/api build`
- `pnpm --filter @sentinel-apex/api typecheck`
- `pnpm --filter @sentinel-apex/api test`
- `pnpm install`
- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/runtime typecheck`
- `pnpm --filter @sentinel-apex/api typecheck`
- `pnpm --filter @sentinel-apex/ops-dashboard typecheck`
- `pnpm --filter @sentinel-apex/ops-dashboard lint`
- `pnpm --filter @sentinel-apex/ops-dashboard build`
- `pnpm --filter @sentinel-apex/ops-dashboard test`
- `pnpm install`
- `pnpm --filter @sentinel-apex/shared build`
- `pnpm --filter @sentinel-apex/db build`
- `pnpm --filter @sentinel-apex/api typecheck`
- `pnpm --filter @sentinel-apex/api test`
- `pnpm --filter @sentinel-apex/ops-dashboard typecheck`
- `pnpm --filter @sentinel-apex/ops-dashboard lint`
- `pnpm --filter @sentinel-apex/ops-dashboard build`
- `pnpm --filter @sentinel-apex/ops-dashboard test`
- `pnpm --filter @sentinel-apex/venue-adapters build`
- `pnpm --filter @sentinel-apex/treasury build`
- `pnpm --filter @sentinel-apex/treasury test`
- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/runtime test`
- `pnpm --filter @sentinel-apex/api typecheck`
- `pnpm --filter @sentinel-apex/api test`
- `pnpm --filter @sentinel-apex/ops-dashboard typecheck`
- `pnpm --filter @sentinel-apex/ops-dashboard build`
- `pnpm --filter @sentinel-apex/ops-dashboard test`
- `CI=1 pnpm build`
- `CI=1 pnpm typecheck`
- `CI=1 pnpm lint`
- `CI=1 pnpm test`
- `pnpm --filter @sentinel-apex/venue-adapters build`
- `pnpm --filter @sentinel-apex/runtime typecheck`
- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/runtime test`
- `pnpm --filter @sentinel-apex/api typecheck`
- `pnpm --filter @sentinel-apex/api build`
- `pnpm --filter @sentinel-apex/api test`
- `pnpm --filter @sentinel-apex/ops-dashboard typecheck`
- `pnpm --filter @sentinel-apex/ops-dashboard build`
- `pnpm --filter @sentinel-apex/ops-dashboard test`
- `pnpm --filter @sentinel-apex/venue-adapters test`
- `pnpm validate:ci`

Results:

- `pnpm validate:ci` now passes the canonical root `build`, `typecheck`, `lint`, and `test` contract.
- Phase 5.3 targeted build, typecheck, lint, and test commands for `venue-adapters`, `runtime`, `api`, and `ops-dashboard` pass on the current tree.
- `pnpm install --frozen-lockfile` now also passes, which matches the new CI workflow entrypoint.
- `pnpm test` also passes after the Turbo `test.outputs` warning cleanup, so the root test gate no longer reports false missing-output warnings.
- Root lint no longer fails on hidden runtime/venue-adapter issues discovered during this pass.
- Repo-owned lint noise was reduced by removing the misleading `decimal.js` import warning and suppressing unsupported-TypeScript parser banners in ESLint output.
- Turbo task invalidation is now more trustworthy because root/package config changes participate in cache invalidation.
- `packages/db` now participates in root lint/test orchestration consistently with the rest of the repo.
- Remaining non-failing noise during tests comes from Vitest/Vite CJS deprecation output and from `apps/runtime-worker` intentionally having no test files while still exposing a standard `test` script.

## Recommended Next Actions

1. Expand venue-truth depth beyond generic Solana RPC into venue-native derivative positions, liquidity, and richer execution history only when a real connector can supply that truth honestly.
2. Add stronger freshness and projection-age detectors if runtime metadata evolves to support stricter staleness policies.
3. Decide whether some remediation actions should auto-attach operator resolution hints once a deterministic success condition is observed.
4. Add admin-facing operator management and stronger session lifecycle tooling only if internal operational complexity justifies it.
5. Expand the ops dashboard from the current treasury and allocator foundations into richer command detail and finding-to-mismatch-to-remediation navigation.
6. Add real treasury connectors only after venue approvals and operational runbooks are ready.
7. Decide whether approved rebalance budget state should later translate into treasury venue actions and carry deployment workflows under separate operator controls.
