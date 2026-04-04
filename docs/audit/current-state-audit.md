# Current State Audit

Date: 2026-04-03
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
  - durable connector promotion workflow state with request, approval, rejection, suspension, append-only event history, decision notes, evidence snapshots, and actor attribution
  - truth-backed connector readiness evidence and eligibility computation that separates technical capability, operator approval status, and current sensitive-execution eligibility
  - promotion-aware carry and treasury execution gating that blocks unapproved, rejected, suspended, stale, degraded, or otherwise ineligible connectors with explicit auditable reasons
  - richer venue-truth depth with typed account-state, balance-state, capacity-state, exposure-state, execution-reference state, derivative-account metadata, derivative/order coverage, completeness, coverage, source metadata, and venue truth profiles
  - explicit venue-truth reconciliation coverage for missing, stale, unavailable, partial, and execution-reference mismatch states on real connector snapshots, including derivative-aware partial posture where supported
  - connector-depth and comparison-coverage projections that distinguish simulation, generic RPC read-only, Drift-native read-only decode, and the narrower direct reconciliation coverage the runtime can actually support
  - canonical internal derivative account state from runtime tracking config, canonical internal open-order inventory from persisted runtime orders, durable internal position inventory derived from fills, derived internal health posture from persisted portfolio/risk projections, and explicit unsupported boundaries for non-venue-native margin fields
  - canonical market identity propagation from market data and opportunity legs into strategy intents, carry planned orders, runtime orders, carry execution steps, fills, and internal derivative snapshots when richer venue-native metadata is truly known
  - durable internal derivative snapshot history plus current-state views for per-venue operator inspection and reconciliation use
  - derivative comparison detail and summary views that distinguish matched, mismatched, internal-only, external-only, and not-comparable state while also exposing exact-vs-partial market identity, comparison basis, and band-level health comparison mode
  - truthful derivative reconciliation findings for stale internal derivative state, Drift subaccount identity mismatch, Drift position mismatch, Drift order-inventory mismatch, partial health comparison, partial market-identity comparison, market-identity gap, and comparison gaps where one side is missing or structurally unsupported
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
- `packages/venue-adapters` now also provides a generic venue-truth contract, the existing generic Solana JSON-RPC truth adapter, and a dedicated Drift-native read-only adapter with decoded user/subaccount semantics, venue-native position inventory, Drift SDK health and margin calculations, open-order inventory, provenance metadata, and explicit unsupported boundaries where decode or comparison depth is unavailable.
- `packages/venue-adapters` now also provides a first real execution-capable connector path:
  - `drift-solana-devnet-carry`
  - real Drift devnet truth plus execution support
  - BTC-PERP reduce-only market-order execution only
  - explicit supported/unsupported scope metadata
  - real Solana transaction signatures persisted as execution references
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
- `packages/db` now also persists connector promotion workflow state in:
  - `venue_connector_promotions`
  - `venue_connector_promotion_events`
- `packages/db` now also persists internal derivative comparison state in:
  - `internal_derivative_snapshots`
  - `internal_derivative_current`
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
- `apps/api` now also serves generic venue inventory, readiness, summary counts, truth-depth summary, richer venue detail, snapshot history, connector-depth rollups, comparison-coverage views for Drift-native read-only truth, per-venue internal derivative state, comparison summary/detail views with derived internal health posture and normalized market identity, plus carry action/execution detail payloads that expose market identity provenance on planned orders and execution steps.
- `apps/api` now also serves connector promotion summary, per-venue promotion detail/history, promotion eligibility evidence, and authenticated request/approve/reject/suspend mutations with backend-enforced role checks.
- `apps/api` now also serves carry recommendations/actions, carry action detail, action-scoped carry execution history, dedicated carry execution detail, carry venue capability state, explicit carry evaluation queueing, and carry approval-driven execution queueing.
- `apps/api` venue and carry detail routes now also expose the first devnet execution-capable connector posture, supported scope metadata, promotion/evidence state, execution mode detail, and persisted real execution references where present.
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
  - a generic venues inventory page with real-vs-simulated, read-only-vs-execution-capable, connector-depth, freshness, truth-depth summary, and snapshot-history drill-through
  - a connector promotion workflow panel on venue detail with durable posture, evidence, missing prerequisites, approval/rejection notes, history timeline, and operator/admin controls
  - promotion-aware venue inventory summaries for candidates, pending reviews, approved-and-eligible connectors, suspended connectors, and evidence-blocked connectors
  - per-venue truth detail with completeness, coverage, connector depth, provenance, decoded derivative account state, position inventory, health/margin state, open-order inventory, internal derivative state, derived internal health posture, normalized market identity comparison detail, identity basis visibility, and recent reference visibility
  - a first controlled-execution carry page with recommendation/actionability visibility, blocked reasons, execution history, venue readiness, and carry action drill-through
  - dedicated carry execution list/detail drill-through with step-level outcomes, timeline visibility, and explicit market identity provenance on planned orders and execution steps
  - explicit venue-detail posture for the first devnet execution-capable connector, including connector mode, supported scope, unsupported scope, and promotion evidence
  - carry execution detail visibility for real-versus-simulated step execution mode plus persisted execution references
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
- Connector lifecycle is now explicit and operator-driven:
  - technical capability is derived from persisted connector truth
  - promotion status is durable and auditable
  - current sensitive-execution eligibility is recomputed from current evidence and may diverge from prior approval
- Generic venue truth now also exposes canonical connector type, sleeve applicability, truth source, snapshot freshness, health, last successful snapshot time, completeness, coverage, connector depth, comparison coverage, provenance, and typed account/exposure/derivative/reference depth where supported.
- The repo now has one honest real execution path:
  - Drift devnet carry reduction execution through the existing operator approval and runtime command rail
  - promotion and current evidence still gate that path
  - no connector ships auto-approved
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
- Full production-grade live carry connectors and venue onboarding beyond explicit simulated posture plus the single narrow devnet execution path.
- Broad real execution-capable venue connectors beyond the single narrow Drift devnet carry connector.
- Venue-native liquidity or treasury-style capacity truth for the current read-only connectors.
- Full exact Drift market-index parity for every internal row; Phase 5.8 now preserves richer identity earlier, but exact comparison is still intentionally bounded to rows whose internal lifecycle truly captured venue-native identity:
  - account identity when both internal and external sections exist
  - open-order inventory when venue order ids exist internally and externally
  - exact market identity only where internal strategy, order, execution, or fill metadata truly carries it
  - partial market identity when the internal side falls back to derived symbol or `asset + marketType`
- Exact internal-versus-external Drift health parity across collateral, margin-ratio, and requirement fields; internal health is now derived and partially comparable, not exact venue-native margin truth.
- Multi-account or portfolio-level Drift aggregation beyond a single configured read-only user locator.
- Generic wallet-balance `balanceState` and treasury-style capacity truth for the Drift-native connector, which intentionally models derivative collateral and positions instead.
- Full venue-native order lifecycle parity such as canonical per-order placement timestamps or broader market/orderbook state beyond what Drift user-account decode and recent signatures currently provide.
- Operator management workflows beyond bootstrap and direct DB-backed setup.
- Production-grade mainnet venue integration.
- Auto-approved or permanently approved real connectors. The new Drift devnet connector still requires operator promotion and current evidence to stay actionable.
- Automatic runbook or onboarding checklist fulfillment from out-of-band evidence. The current system only reasons over persisted truth, connector metadata, and explicit operator actions.
- Backtest foundations.
- Autonomous allocator-to-sleeve routing beyond explicit operator-approved budget-state workflows.
- Autonomous carry deployment directly from allocator evaluation.
- Full venue-native treasury detail for flows that are only budget-state application; those flows are now explicit treasury action/execution records when persisted, but they are still not connector-native treasury venue executions.
- Generic proposal replay, cancel tooling, and autonomous healing; Phases 4.7 through 5.0 add explicit child-scoped recovery, operator closure, escalation handoff, and escalation triage semantics, not autonomous orchestration.
- Fully eliminating toolchain-origin warnings from Vitest/Vite CJS compatibility messages remains out of scope for this pass; the canonical validation commands still complete successfully.

## Validation Results

Commands run against the real repo state:

- `pnpm build`
- `pnpm typecheck`
- `pnpm exec turbo run lint --concurrency=1`
- `pnpm exec turbo run test --concurrency=1`
- `pnpm validate:ci`
- `pnpm --filter @sentinel-apex/runtime typecheck`
- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/runtime lint`
- `pnpm --filter @sentinel-apex/runtime test -- src/__tests__/internal-derivative-state.test.ts`
- `pnpm --filter @sentinel-apex/runtime test -- src/__tests__/runtime.test.ts`
- `pnpm --filter @sentinel-apex/runtime test -- src/__tests__/worker.test.ts -t "emits partial health and market-identity gap findings without inventing exact mismatches"`
- `pnpm --filter @sentinel-apex/config test -- src/__tests__/env.test.ts`
- `pnpm --filter @sentinel-apex/venue-adapters test -- src/__tests__/drift-devnet-carry-adapter.test.ts`
- `pnpm --filter @sentinel-apex/runtime test -- src/__tests__/devnet-execution-path.test.ts`
- `pnpm --filter @sentinel-apex/api test -- src/__tests__/runtime-api.test.ts`
- `pnpm --filter @sentinel-apex/ops-dashboard test -- src/test/phase-6-devnet-execution-pages.test.tsx`
- `pnpm --filter @sentinel-apex/runtime test -- src/__tests__/worker.test.ts`
- `pnpm --filter @sentinel-apex/api typecheck`
- `pnpm --filter @sentinel-apex/api lint`
- `pnpm --filter @sentinel-apex/api build`
- `pnpm --filter @sentinel-apex/api test -- src/__tests__/runtime-api.test.ts`
- `pnpm --filter @sentinel-apex/ops-dashboard typecheck`
- `pnpm --filter @sentinel-apex/ops-dashboard lint`
- `pnpm --filter @sentinel-apex/ops-dashboard build`
- `pnpm --filter @sentinel-apex/ops-dashboard test -- src/app-pages.test.tsx`
- `pnpm --filter @sentinel-apex/venue-adapters typecheck`
- `pnpm --filter @sentinel-apex/venue-adapters lint`

Results:

- Initial root `pnpm lint` and `pnpm validate:ci` attempts in this sandbox hit exit `143` during concurrent Turbo lint fan-out rather than surfacing repo-owned lint failures.
- Phase 5.7 now hardens the root validation contract with serialized `lint:ci` and `test:ci` entrypoints, and canonical `pnpm validate:ci` passes on the current tree.
- Full-monorepo `pnpm build`, `pnpm typecheck`, `pnpm exec turbo run lint --concurrency=1`, and `pnpm exec turbo run test --concurrency=1` pass on the current tree.
- Targeted validation for `runtime`, `api`, `ops-dashboard`, and `venue-adapters` passes on the current tree.
- Remaining non-failing noise during tests is limited to Vitest/Vite CJS deprecation output and normal simulated-adapter test logs.

## Recommended Next Actions

1. Decide whether Sentinel Apex should own a venue-aligned internal margin model for any exact health-field comparison beyond the current band-level posture.
2. Extend the same market-identity provenance discipline into more allocator and rebalance downstream records so proposal-to-execution drill-through stays exact where the repo truly knows more.
3. Decide whether some derivative comparison gaps should auto-link to operator remediation guidance once stable mismatch patterns are observed.
4. Expand the ops dashboard from the current venue-detail comparison view into richer finding-to-mismatch-to-remediation drill-through.
5. Add real treasury or execution-capable connectors only after venue approvals and separate operational runbooks are ready.
