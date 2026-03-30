# Sentinel Apex

Sentinel Apex is a TypeScript monorepo for the institutional Solana yield control plane. The current repo includes the internal API, a dedicated runtime worker, an internal ops dashboard, core strategy/risk/execution packages, durable recovery visibility, reconciliation-driven mismatch detection, mismatch-scoped remediation actions, the Atlas Treasury foundation, the Sentinel allocator foundation, carry controlled execution with dedicated execution drill-through, treasury execution drill-through with rebalance-linked budget-application visibility, rebalance bundle coordination with partial-failure rollups and operator recovery semantics, and a Postgres-first local/dev workflow.

## Local Dev Workflow

Minimum environment:

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
export API_SECRET_KEY=replace-with-at-least-32-characters
export OPS_AUTH_SHARED_SECRET=replace-with-at-least-32-characters
export EXECUTION_MODE=dry-run
export FEATURE_FLAG_LIVE_EXECUTION=false
export RUNTIME_WORKER_CYCLE_INTERVAL_MS=60000
```

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

The API is now the control-plane and read surface. Scheduled cycle execution, command processing, recovery work, reconciliation, treasury evaluation, allocator evaluation, and carry evaluation continue to run in the backend services. The ops dashboard is a thin internal UI over those existing API contracts. Treasury evaluation now runs as part of real runtime cycles and can also be queued explicitly from the authenticated treasury page in the ops dashboard. Sentinel allocator evaluation now runs during runtime cycles and can also be queued explicitly, producing persisted current-vs-target sleeve budgets, structured rationale, and rebalance recommendations without hidden execution side effects. Atlas Treasury recommendations can now be approved and executed through the existing runtime worker flow, with explicit simulated/live boundaries, backend risk checks, durable execution history, action/execution drill-through, and venue readiness visibility. Treasury rebalance participation can now also persist explicit proposal-linked treasury action/execution records for budget-state-only changes, so rebalance drill-through can link into treasury detail without pretending every treasury outcome is venue-native. Carry now also has first-class controlled execution semantics: approved strategy opportunities and rebalance-linked carry changes produce explicit carry actions, backend-enforced operational blocked reasons, simulated-vs-live venue state, durable command/execution history, dedicated execution-step drill-through, and dashboard/API visibility without pretending unsupported live deployment exists. Sentinel now also exposes an operator-approved rebalance workflow: allocator runs can emit durable rebalance proposals, operators can approve or reject them, the worker executes explicit rebalance commands, runtime exposes a backend-native proposal execution graph across proposal, command, and downstream sleeve work, and rebalance bundles now summarize whether the coordinated multi-sleeve workflow is complete, partially applied, blocked, failed, or awaiting intervention without introducing autonomous routing.

Stop or reset local Postgres:

```bash
pnpm db:stop
pnpm db:reset
```

## Validation

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Current Scope

- `apps/api` is the control-plane and read API.
- `apps/runtime-worker` is the dedicated scheduler and cycle executor.
- `apps/ops-dashboard` is the internal operator UI for runtime, allocator, mismatch, reconciliation, recovery, and command inspection.
- `apps/ops-dashboard` now also includes treasury action detail, execution detail, and venue readiness views on top of the main treasury page.
- `apps/ops-dashboard` now also includes a dedicated treasury execution history page and treasury execution detail links back into rebalance proposal context when available.
- `apps/ops-dashboard` now also includes a carry sleeve page and carry action detail view for controlled execution workflows.
- `apps/ops-dashboard` now also includes rebalance bundle detail for coordinated downstream carry/treasury status and recovery guidance.
- `apps/ops-dashboard` now uses explicit operator authentication, durable sessions, and role-aware action gating.
- Runtime lifecycle, replay, current projections, worker state, and recovery persistence are in `packages/runtime`.
- `packages/allocator` now provides the Sentinel sleeve registry, deterministic budgeting policy, allocator rationale, and rebalance recommendation generation.
- `packages/allocator` now also provides deterministic rebalance proposal planning and blocked-reason generation for operator-approved sleeve-budget moves.
- `packages/treasury` now provides the Atlas Treasury policy engine, reserve checks, concentration checks, treasury recommendation logic, and treasury execution-intent planning.
- `packages/carry` now also provides carry controlled-execution planning, backend readiness evaluation, blocked-reason generation, pre-execution effects, and deterministic reduction-intent planning.
- Runtime mismatches now support acknowledge, recover, resolve, verify, and reopen lifecycle actions with durable recovery history.
- Runtime reconciliation now persists explicit runs and findings, and can create or update mismatches from real discrepancies across projections, commands, orders, and positions.
- Runtime mismatches also support first-class remediation attempts for `rebuild_projections` and `run_cycle`, with durable linkage to commands and recovery outcomes.
- The API exposes reconciliation runs, findings, summary, and mismatch-linked finding history for operator workflows.
- The API now also exposes allocator summary, latest sleeve targets, decision history/detail, run history, and explicit allocator evaluation queueing.
- The API now also exposes allocator rebalance proposal list/detail, decision-linked proposal history, and rebalance approval/rejection actions.
- The API now also exposes rebalance bundle list/detail, bundle timeline, and proposal-to-bundle linkage.
- The API now also exposes treasury summary, allocations, policy, recommendation/action detail, action-scoped execution history, execution detail, venue readiness/detail, treasury approval, and treasury execution queueing.
- The API now also exposes carry recommendations/actions, carry action detail, carry execution history/detail, carry venue readiness, carry evaluation queueing, and carry approval-driven execution queueing.
- Sensitive runtime and control mutations now require authenticated operator identity and backend role authorization.
- Dry-run remains the default and supported operating mode.
- Live execution is still opt-in and separately gated.
- The allocator foundation is now implemented as a deterministic recommendation and operator-approved rebalance-planning layer. Backtest is still not implemented. Treasury now supports controlled execution semantics and operator drill-through, but live treasury connectors are still not implemented and simulated execution remains explicitly labeled. Carry now also supports controlled execution semantics, operator drill-through, and rebalance-linked downstream actions, but unsupported live carry connectors remain explicitly blocked and allocator-driven routing is still not autonomous venue routing.
