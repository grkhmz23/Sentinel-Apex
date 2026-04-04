# Sentinel Apex

Sentinel Apex is a TypeScript monorepo for the institutional Solana yield control plane. The current repo includes the internal API, a dedicated runtime worker, an internal ops dashboard, core strategy/risk/execution packages, durable recovery visibility, reconciliation-driven mismatch detection, mismatch-scoped remediation actions, the Atlas Treasury foundation, the Sentinel allocator foundation, carry controlled execution with dedicated execution drill-through, treasury execution drill-through with rebalance-linked budget-application visibility, rebalance bundle coordination with partial-failure rollups and operator recovery semantics, explicit bundle recovery actions for safe child requeue, explicit manual resolution for partial or non-retryable bundles, explicit escalation ownership and handoff workflow for escalated bundles, a cross-bundle escalations queue and triage board, deeper read-only venue-native truth coverage for connector account, exposure-like, recent-reference, and Drift-native account/position/health/order semantics, plus a richer internal derivative state and comparison layer with derived internal health posture, normalized market identity, earlier venue-native market metadata propagation through intent/order/execution/fill history, exact-identity promotion where the internal side truly captured stronger metadata, a first narrow devnet execution-capable connector path, and a Postgres-first local/dev workflow.

Phase 6.0 adds the first honest real execution path on top of the Phase 5.9 promotion workflow. Connector capability, operator approval state, and current live-readiness eligibility remain separate concepts. Approval is explicit and durable. Current sensitive-execution eligibility is recomputed from real persisted truth and can be lost when connector evidence becomes stale, degraded, or incomplete.

The repo now also exposes one explicit hackathon-facing strategy profile, `Apex USDC Delta-Neutral Carry`. That profile is policy-enforced in code: base asset must remain `USDC`, tenor must remain a 3-month rolling lock with 3-month reassessment, target APY floor defaults to `10%`, projected APY is separated from realized APY, and disallowed yield sources such as DEX LP, junior tranche / insurance pool, and circular stable-yield dependencies are blocked explicitly. This is a strategy-policy/readiness surface, not a production-readiness claim.

## Local Dev Workflow

Minimum environment:

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
export API_SECRET_KEY=replace-with-at-least-32-characters
export OPS_AUTH_SHARED_SECRET=replace-with-at-least-32-characters
export EXECUTION_MODE=dry-run
export FEATURE_FLAG_LIVE_EXECUTION=false
export DRIFT_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
export DRIFT_READONLY_ENV=mainnet-beta
# Choose one locator mode:
export DRIFT_READONLY_ACCOUNT_ADDRESS=replace-with-a-drift-user-account-public-key
# or
export DRIFT_READONLY_AUTHORITY_ADDRESS=replace-with-a-drift-authority-public-key
export DRIFT_READONLY_SUBACCOUNT_ID=0
export DRIFT_READONLY_ACCOUNT_LABEL="optional human label"
export RUNTIME_WORKER_CYCLE_INTERVAL_MS=60000
```

Optional Phase 6.0 devnet execution env for the first real connector path:

```bash
export EXECUTION_MODE=live
export FEATURE_FLAG_LIVE_EXECUTION=true
export DRIFT_RPC_ENDPOINT=https://api.devnet.solana.com
export DRIFT_READONLY_ENV=devnet
export DRIFT_EXECUTION_ENV=devnet
export DRIFT_PRIVATE_KEY=replace-with-devnet-secret-key
export DRIFT_EXECUTION_SUBACCOUNT_ID=0
export DRIFT_EXECUTION_ACCOUNT_LABEL="Hackathon Devnet Carry"
```

Use the optional block only in a dedicated devnet shell. It is not compatible with the default mainnet-beta read-only example above.

Start local Postgres and apply migrations:

```bash
pnpm db:start
pnpm db:health
pnpm db:migrate
```

Run one deterministic runtime cycle from the package directly:

```bash
pnpm --filter @sentinel-apex/runtime dev:run-cycle
```

Rebuild current projections from durable state:

```bash
pnpm --filter @sentinel-apex/runtime dev:rebuild-projections
```

Start the API:

```bash
pnpm --filter @sentinel-apex/api dev
```

Start the dedicated runtime worker:

```bash
pnpm --filter @sentinel-apex/runtime-worker dev
```

Start the internal ops dashboard:

```bash
export OPS_DASHBOARD_API_BASE_URL=http://localhost:3000
export OPS_DASHBOARD_API_KEY=${API_SECRET_KEY}
PORT=3100 pnpm --filter @sentinel-apex/ops-dashboard dev
```

Bootstrap an internal operator account for local dashboard access:

```bash
pnpm --filter @sentinel-apex/ops-dashboard bootstrap:operator -- \
  --operator-id local-admin \
  --email ops@example.com \
  --display-name "Local Admin" \
  --password "replace-with-a-long-password" \
  --role admin
```

Open `http://localhost:3100/sign-in` and authenticate with the bootstrapped operator account.

Mutation endpoints are now operator-authorized in addition to API-key protected. For local manual control actions, prefer using the ops dashboard or the server-side proxy rather than unsigned `curl` requests.

## Read-Only Venue Truth

The in-repo read-only real connector path remains:

- `drift-solana-readonly`

This connector is real and read-only only. It is not execution-capable and not approved for live use. Its current connector depth is `drift_native_readonly`.

With only `DRIFT_RPC_ENDPOINT`, Sentinel captures connectivity-level venue truth. When a Drift user locator is also configured through `DRIFT_READONLY_ACCOUNT_ADDRESS` or `DRIFT_READONLY_AUTHORITY_ADDRESS` plus `DRIFT_READONLY_SUBACCOUNT_ID`, the runtime can additionally capture:

- decoded Drift user-account and subaccount identity
- account metadata via `getAccountInfo`
- venue-native perp and spot position inventory
- exposure summaries derived from decoded positions
- Drift SDK-derived health, collateral, free-collateral, leverage, and margin requirement state
- venue-native open-order inventory decoded from the Drift user account
- recent account transaction references via `getSignaturesForAddress`
- source metadata including connector depth, observed slot, and provenance
- comparison coverage that explains which sections are operator-visible truth versus directly reconciled state

The runtime now also persists a separate internal derivative model for the same venue:

- account identity from runtime operator configuration
- open-order inventory from canonical runtime orders
- position inventory derived from canonical fills joined to runtime orders
- derived internal health posture from persisted portfolio and risk projections
- normalized market identity on internal positions and orders
- canonical market identity propagated through strategy intents, carry planned orders, runtime orders, carry execution steps, execution events, and fills when the pipeline truly knows more than `asset + marketType`
- comparison summary and comparison detail views that separate:
  - matched
  - mismatched
  - internal-only
  - external-only
  - not-comparable

This path still does not provide:

- treasury-style capacity truth
- generic wallet `balanceState` for the Drift-native connector
- exact Drift health parity across collateral, margin-ratio, and requirement fields
- exact internal market-index parity for every row when persisted internal metadata never carried it
- canonical placement timestamps for every open order
- live execution support

## First Real Devnet Execution Path

Phase 6.0 adds one execution-capable connector:

- `drift-solana-devnet-carry`

Its supported scope is intentionally narrow:

- devnet only
- carry sleeve only
- BTC-PERP reduce-only market orders only
- real Solana transaction signatures persisted as execution references

This path reuses the existing carry action approval and runtime command rail. It does not add:

- generic order entry
- treasury-native real execution
- increase-carry-exposure execution
- mainnet execution
- silent fallback from real to simulated

Operator-facing inspection for this path is available through:

- `/api/v1/venues/drift-solana-devnet-carry`
- `/api/v1/venues/drift-solana-devnet-carry/promotion`
- `/api/v1/venues/drift-solana-devnet-carry/promotion/eligibility`
- `/api/v1/carry/actions/:actionId`
- `/api/v1/carry/executions/:executionId`

The ops dashboard surfaces the same truth on `/venues/:venueId` and `/carry/executions/:executionId`.

Operator-facing venue truth is available through:

- `/api/v1/venues`
- `/api/v1/venues/summary`
- `/api/v1/venues/truth-summary`
- `/api/v1/venues/:venueId`
- `/api/v1/venues/:venueId/internal-state`
- `/api/v1/venues/:venueId/comparison-summary`
- `/api/v1/venues/:venueId/comparison-detail`
- `/api/v1/venues/:venueId/snapshots`

Reconciliation also exposes venue-truth findings for:

- missing snapshots
- stale snapshots
- unavailable snapshots
- partial truth coverage
- execution-reference mismatch where the connector truth actually exposes recent references
- stale internal derivative state
- Drift subaccount identity mismatch
- Drift partial health comparison
- Drift partial market-identity comparison
- Drift position identity gap
- Drift market-identity mismatch where exact internal identity exists
- Drift position mismatch
- Drift order-inventory mismatch
- Drift truth comparison gaps when one side is missing or structurally unsupported

The API is now the control-plane and read surface. Scheduled cycle execution, command processing, recovery work, reconciliation, treasury evaluation, allocator evaluation, and carry evaluation continue to run in the backend services. The ops dashboard is a thin internal UI over those existing API contracts. Treasury evaluation now runs as part of real runtime cycles and can also be queued explicitly from the authenticated treasury page in the ops dashboard. Sentinel allocator evaluation now runs during runtime cycles and can also be queued explicitly, producing persisted current-vs-target sleeve budgets, structured rationale, and rebalance recommendations without hidden execution side effects. Atlas Treasury recommendations can now be approved and executed through the existing runtime worker flow, with explicit simulated/live boundaries, backend risk checks, durable execution history, action/execution drill-through, and venue readiness visibility. Treasury rebalance participation can now also persist explicit proposal-linked treasury action/execution records for budget-state-only changes, so rebalance drill-through can link into treasury detail without pretending every treasury outcome is venue-native. Carry now also has first-class controlled execution semantics: approved strategy opportunities and rebalance-linked carry changes produce explicit carry actions, backend-enforced operational blocked reasons, simulated-vs-live venue state, durable command/execution history, dedicated execution-step drill-through, and dashboard/API visibility without pretending unsupported live deployment exists. Sentinel now also exposes an operator-approved rebalance workflow: allocator runs can emit durable rebalance proposals, operators can approve or reject them, the worker executes explicit rebalance commands, runtime exposes a backend-native proposal execution graph across proposal, command, and downstream sleeve work, rebalance bundles summarize whether the coordinated multi-sleeve workflow is complete, partially applied, blocked, failed, or awaiting intervention, operators can request explicit bundle recovery actions for safely retryable proposal-linked carry and treasury children, operators can explicitly accept partial application or mark a bundle manually resolved, escalated bundles carry explicit ownership, acknowledgement, review, and close workflow, and operators can now triage those escalations from a dedicated cross-bundle queue without hidden automation.

## Connector Promotion And Live Readiness

Phases 5.9 and 6.0 still do not broadly enable live execution. They add the durable workflow and one narrow devnet execution path required before any broader connector could honestly be treated as live-ready.

Current model:

- capability class
  - `simulated_only`
  - `real_readonly`
  - `execution_capable`
- promotion status
  - `not_requested`
  - `pending_review`
  - `approved`
  - `rejected`
  - `suspended`
- effective posture
  - `simulated_only`
  - `real_readonly`
  - `execution_capable_unapproved`
  - `promotion_pending`
  - `approved_for_live`
  - `rejected`
  - `suspended`

Important boundary:

- read-only truth is not live approval
- execution capability is not live approval
- approval is durable and auditable
- approved connectors are still blocked from sensitive execution when current evidence is stale, degraded, incomplete, or otherwise ineligible
- for `drift-solana-devnet-carry`, approval remains scoped to the connector's declared devnet-only contract

Operator-facing promotion surfaces now include:

- `/api/v1/venues/promotion-summary`
- `/api/v1/venues/:venueId/promotion`
- `/api/v1/venues/:venueId/promotion/history`
- `/api/v1/venues/:venueId/promotion/eligibility`
- `/api/v1/venues/:venueId/promotion/request`
- `/api/v1/venues/:venueId/promotion/approve`
- `/api/v1/venues/:venueId/promotion/reject`
- `/api/v1/venues/:venueId/promotion/suspend`

The ops dashboard exposes the same workflow from the generic venue inventory and per-venue detail pages.

Stop or reset local Postgres:

```bash
pnpm db:stop
pnpm db:reset
```

## Validation

Canonical root validation commands:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Preferred developer and CI entrypoints:

```bash
pnpm validate
pnpm validate:ci
pnpm release:check
```

Validation contract:

- `pnpm build`: canonical repo-wide build through Turbo.
- `pnpm typecheck`: canonical repo-wide TypeScript gate.
- `pnpm lint`: canonical repo-wide lint gate.
- `pnpm test`: canonical repo-wide package/app test orchestration.
- `pnpm validate`: required local confidence check before merge when touching multiple packages or control-plane flows.
- `pnpm validate:ci`: same validation contract under `CI=1`.
- `pnpm release:check`: CI validation plus `pnpm format:check`.

Guidance:

- Use targeted `pnpm --filter <workspace> <task>` commands while iterating.
- Use `pnpm validate` before merge for multi-package or high-risk changes.
- Use `pnpm release:check` before tagging or promoting a release candidate.
- `pnpm test:workspace` is optional and runs the root Vitest workspace directly; the canonical repo-wide test gate remains `pnpm test`.

Known limitations:

- Some package tests are intentionally slow because they boot real runtime/API harnesses.
- Sandbox restrictions can still prevent long-running service startup flows that bind sockets; validation should prefer direct test/build/typecheck/lint entrypoints over ad hoc manual server startup.
- Live connector validation remains out of scope; dry-run and simulated execution are the supported default validation posture.
- Phases 5.5 through 5.9 deepen read-only real connector truth ingestion into Drift-native account, position, health, and open-order semantics, add an internal derivative state and comparison layer, preserve richer market metadata earlier, and add a durable connector promotion workflow. This still does not approve a new live connector by itself.

## Current Scope

- `apps/api` is the control-plane and read API.
- `apps/runtime-worker` is the dedicated scheduler and cycle executor.
- `apps/ops-dashboard` is the internal operator UI for runtime, allocator, mismatch, reconciliation, recovery, and command inspection.
- `apps/ops-dashboard` now also includes treasury action detail, execution detail, and venue readiness views on top of the main treasury page.
- `apps/ops-dashboard` now also includes a dedicated treasury execution history page and treasury execution detail links back into rebalance proposal context when available.
- `apps/ops-dashboard` now also includes a carry sleeve page and carry action detail view for controlled execution workflows.
- `apps/ops-dashboard` now also includes rebalance bundle detail for coordinated downstream carry/treasury status and recovery guidance.
- `apps/ops-dashboard` now also includes bundle recovery candidates and bundle recovery history for explicit operator retry requests.
- `apps/ops-dashboard` now also includes partial-progress inspection and manual bundle resolution history/options.
- `apps/ops-dashboard` now also includes escalation ownership, handoff, review, and close workflow on rebalance bundles.
- `apps/ops-dashboard` now also includes a dedicated escalations queue with status, owner, due-state filters, ownership visibility, and safe quick triage actions.
- `apps/ops-dashboard` now also includes a generic `/venues` inventory and per-venue snapshot history/detail for connector truth, readiness, and truth-depth visibility.
- `apps/ops-dashboard` now also includes internal derivative state, external derivative truth, comparison coverage, and mismatch/gap detail on per-venue views.
- `apps/ops-dashboard` now uses explicit operator authentication, durable sessions, and role-aware action gating.
- Runtime lifecycle, replay, current projections, worker state, and recovery persistence are in `packages/runtime`.
- `packages/runtime` now also persists internal derivative snapshots and current-state rows used for Drift-oriented internal-vs-external comparison.
- `packages/allocator` now provides the Sentinel sleeve registry, deterministic budgeting policy, allocator rationale, and rebalance recommendation generation.
- `packages/allocator` now also provides deterministic rebalance proposal planning and blocked-reason generation for operator-approved sleeve-budget moves.
- `packages/treasury` now provides the Atlas Treasury policy engine, reserve checks, concentration checks, treasury recommendation logic, and treasury execution-intent planning.
- `packages/carry` now also provides carry controlled-execution planning, backend readiness evaluation, blocked-reason generation, pre-execution effects, and deterministic reduction-intent planning.
- Runtime mismatches now support acknowledge, recover, resolve, verify, and reopen lifecycle actions with durable recovery history.
- Runtime reconciliation now persists explicit runs and findings, and can create or update mismatches from real discrepancies across projections, commands, orders, positions, and supported venue-truth depth.
- Runtime reconciliation now also emits truthful Drift derivative findings only where both internal and external state are genuinely comparable.
- Runtime mismatches also support first-class remediation attempts for `rebuild_projections` and `run_cycle`, with durable linkage to commands and recovery outcomes.
- The API exposes reconciliation runs, findings, summary, and mismatch-linked finding history for operator workflows.
- The API now also exposes allocator summary, latest sleeve targets, decision history/detail, run history, and explicit allocator evaluation queueing.
- The API now also exposes allocator rebalance proposal list/detail, decision-linked proposal history, and rebalance approval/rejection actions.
- The API now also exposes rebalance bundle list/detail, bundle timeline, and proposal-to-bundle linkage.
- The API now also exposes bundle recovery candidates, bundle recovery action history/detail, and explicit bundle recovery request mutations.
- The API now also exposes bundle manual-resolution options, manual-resolution history/detail, and explicit operator closure mutations.
- The API now also exposes bundle escalation detail/history and explicit assignment, acknowledgement, review, and close mutations.
- The API now also exposes an escalations queue, queue summary counts, and an authenticated mine view.
- The API now also exposes generic venue inventory, venue readiness, venue summary counts, truth-depth summary, and per-venue snapshot detail.
- The API now also exposes venue internal-state, comparison-summary, and comparison-detail surfaces for operators.
- The API now also exposes treasury summary, allocations, policy, recommendation/action detail, action-scoped execution history, execution detail, venue readiness/detail, treasury approval, and treasury execution queueing.
- The API now also exposes carry recommendations/actions, carry action detail, carry execution history/detail, carry venue readiness, carry evaluation queueing, and carry approval-driven execution queueing.
- Sensitive runtime and control mutations now require authenticated operator identity and backend role authorization.
- Dry-run remains the default and supported operating mode.
- Live execution is still opt-in and separately gated.
- Real connector support is now explicit across:
  - simulated only
  - real read-only
  - real execution-capable
- The in-repo real connector path is currently `drift-solana-readonly`, which is read-only only and not approved for live use.
- The allocator foundation is now implemented as a deterministic recommendation and operator-approved rebalance-planning layer. Backtest is still not implemented. Treasury now supports controlled execution semantics and operator drill-through, but live treasury connectors are still not implemented and simulated execution remains explicitly labeled. Carry now also supports controlled execution semantics, operator drill-through, and rebalance-linked downstream actions, but unsupported live carry connectors remain explicitly blocked and allocator-driven routing is still not autonomous venue routing. Bundle recovery, manual closure, escalation handoff, and escalation triage are explicit operator workflows; generic proposal replay and autonomous healing still remain out of scope.
