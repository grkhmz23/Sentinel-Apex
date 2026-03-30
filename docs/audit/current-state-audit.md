# Current State Audit

Date: 2026-03-30
Repo: `/workspaces/Sentinel-Apex`

## What Exists

- Monorepo tooling: `pnpm`, Turborepo, TypeScript, ESLint, Prettier, Vitest.
- Apps: `apps/api`, `apps/runtime-worker`, `apps/ops-dashboard`.
- Packages: `allocator`, `carry`, `config`, `db`, `domain`, `execution`, `observability`, `risk-engine`, `runtime`, `shared`, `strategy-engine`, `treasury`, `venue-adapters`.
- Docs: `docs/prd`, `docs/architecture`, `docs/adr`, `docs/risk`, `docs/strategy`, `docs/audit`.
- Infra: `docker-compose.yml`, `infra/docker/Dockerfile.api`, `infra/docker/docker-compose.local-db.yml`.

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
  - `allocator_rebalance_current`
- `apps/api` serves portfolio, risk, orders, positions, opportunities, events, runtime status, worker status, mismatch history, and control surfaces from persisted runtime-backed state.
- `apps/api` now also serves treasury summary, allocations, policy, recommendations, action detail, execution detail, venue readiness/detail, treasury approval, and explicit treasury execution queueing.
- `apps/api` now also serves allocator summary, latest sleeve targets, decision history/detail, run history, and explicit allocator evaluation queueing.
- `apps/api` now also serves rebalance proposal list/detail, decision-linked proposals, and rebalance approval/rejection actions.
- `apps/runtime-worker` executes scheduled cycles, processes runtime commands, and persists scheduler/recovery visibility independently of the API process.
- `apps/ops-dashboard` now provides an internal Next.js operator UI for overview, mismatch inspection, reconciliation visibility, recovery and command inspection, and safe action dispatch through the existing runtime API.
- `apps/ops-dashboard` now also provides:
  - server-side sign-in and sign-out
  - durable operator sessions
  - role-aware action gating for `viewer`, `operator`, and `admin`
  - signed operator propagation from the dashboard proxy into the API
  - Atlas Treasury overview visibility and a dedicated treasury page
  - treasury recommendation readiness, blocked reasons, approval controls, execution controls, and execution history
  - treasury action detail, execution detail, and venue readiness drill-through views
  - a first Sentinel allocator page with current-vs-target sleeve budgets, rationale visibility, decision history, and decision detail
  - rebalance proposal visibility and proposal detail with approval controls and execution outcome state
- `apps/api` now enforces backend operator authorization for sensitive runtime and control mutations in addition to API-key authentication.
- `packages/db` now persists internal operators and dashboard sessions in `ops_operators` and `ops_operator_sessions`.
- Existing runtime actor/audit fields are now populated from authenticated operator identity for dashboard-driven actions instead of client-supplied placeholders.
- Local/dev Postgres workflow now exists through `pnpm db:start`, `pnpm db:health`, `pnpm db:migrate`, `pnpm db:reset`, and `pnpm db:stop`.
- Treasury venue readiness now exposes explicit simulated-vs-real, read-only-vs-execution-capable, onboarding state, and missing-prerequisite metadata to operators.
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

- Reconciliation currently compares persisted internal state against durable projections, runtime command outcomes, and venue state available through the existing adapters. It is real and auditable, but still bounded to the state the current repo can reconcile with confidence.
- API startup in this sandbox still cannot bind to `0.0.0.0` because of environment `listen EPERM` restrictions rather than an application defect.

## What Is Missing

- Broader operator workflows beyond treasury drill-through, especially command detail and richer recovery navigation.
- Operator management workflows beyond bootstrap and direct DB-backed setup.
- Production-grade live venue integration.
- Backtest foundations.
- Autonomous allocator-to-sleeve routing beyond explicit operator-approved budget-state workflows.

## Validation Results

Commands run against the real repo state:

- `CI=1 pnpm build`
- `CI=1 pnpm typecheck`
- `CI=1 pnpm lint`
- `CI=1 pnpm test`

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

Results:

- Build passes in targeted package runs and in the full monorepo run, including the new treasury package and dashboard treasury page.
- Typecheck passes in targeted package runs and in the full monorepo run, including the updated runtime/API/dashboard treasury contracts.
- Tests pass in targeted package runs and in the full monorepo run, including treasury policy, runtime treasury integration, API treasury detail/readiness endpoints, and dashboard treasury drill-through rendering.
- The new auth/session and role-gating package-level checks pass in targeted API and ops-dashboard runs.
- Lint passes in targeted package runs. Existing `import/no-named-as-default` warnings remain in packages that already used `decimal.js` default imports.
- During implementation, API tests briefly failed because `@sentinel-apex/api` consumed a stale `@sentinel-apex/runtime/dist` build artifact that still generated non-UUID position IDs. Rebuilding the runtime package fixed the issue.

## Recommended Next Actions

1. Expand reconciliation coverage to more venue-native state once non-simulated adapters expose reliable external truth.
2. Add stronger freshness and projection-age detectors if runtime metadata evolves to support stricter staleness policies.
3. Decide whether some remediation actions should auto-attach operator resolution hints once a deterministic success condition is observed.
4. Add admin-facing operator management and stronger session lifecycle tooling only if internal operational complexity justifies it.
5. Expand the ops dashboard from the current treasury and allocator foundations into richer command detail and finding-to-mismatch-to-remediation navigation.
6. Add real treasury connectors only after venue approvals and operational runbooks are ready.
7. Decide whether approved rebalance budget state should later translate into treasury venue actions and carry deployment workflows under separate operator controls.
