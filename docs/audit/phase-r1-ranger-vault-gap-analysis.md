# Phase R1 — Ranger Earn + Vault Foundation Gap Analysis

Date: 2026-04-05
Repo: `/workspaces/Sentinel-Apex`
Phase: R1 (Ranger + Vault Foundation)

## Audit Scope

This audit covers the current state of:
1. Ranger Earn integration
2. On-chain vault abstractions
3. Carry/treasury/allocator execution hooks
4. Current vault behavior (internal vs on-chain)
5. Submission dossier endpoint
6. README disclaimers about missing capabilities

## Current State Summary

### What Exists

**Internal Vault Accounting (NOT on-chain)**
- Location: `packages/db/src/schema/vault.ts`
- Schema: `vault_depositors`, `vault_deposit_lots`, `vault_redemption_requests`
- Features: Deposit lots with mint price, lock expiry, redemption eligibility
- API: `/api/v1/vault/*` endpoints in `apps/api/src/routes/vault.ts`
- Dashboard: Basic vault visibility in ops-dashboard

**Strategy/Carry Execution Hooks**
- Location: `packages/carry/src/controlled-execution.ts`
- Features: Carry action lifecycle, execution planning, order intents
- Database: `carry_actions`, `carry_action_executions`, `carry_execution_steps`
- Current capability: Single-leg perp execution (BTC-PERP on Drift devnet)

**Submission Dossier**
- Location: `apps/api/src/routes/submission.ts`
- Endpoint: `/api/v1/submission`
- Features: Dossier CRUD, evidence records, export bundles
- Gaps: No on-chain address verification flow, no CEX API integration

**Venue Adapters**
- Location: `packages/venue-adapters/src/`
- Drift Integration: 
  - `drift-readonly-truth-adapter.ts` - Mainnet readonly
  - `drift-devnet-carry-adapter.ts` - Devnet execution (BTC-PERP only)
  - `drift-mainnet-carry-adapter.ts` - Exists but NOT execution-capable (truth only)
  - `drift-multi-asset-carry-adapter.ts` - Multi-asset readonly
- Simulated adapters for testing

### What Is Missing

**Critical Blockers**

1. **No Ranger Earn SDK Integration**
   - No `@rangerprotocol/sdk` or equivalent in package.json
   - No Ranger vault factory integration
   - No Ranger strategy adapter contract
   - Blocker: External dependency - need Ranger SDK access or program IDs

2. **No On-Chain Vault Program**
   - Internal vault state only (PostgreSQL)
   - No Solana program for vault tokenization
   - No share token mint/burn
   - No deposit/withdrawal instruction handlers
   - Blocker: Need Anchor program or Ranger vault program integration

3. **No Mainnet Execution Path**
   - `DriftMainnetCarryAdapter` is read-only (no `placeOrder` implementation)
   - Only devnet execution exists
   - Blocker: Need to implement mainnet execution with proper key management

4. **No Multi-Leg Carry Orchestration**
   - Only single-leg perp execution
   - No spot+perp coordination
   - No hedge rebalance logic
   - `packages/carry/src/spot-perp-coordination.ts` exists but not integrated

### README Disclaimers (Must Update Truthfully)

Current disclaimers from README.md:
- "No Ranger/Earn integration is implemented in source."
- "No mainnet live carry connector is implemented."
- "The only real execution path is Drift devnet BTC-PERP market execution for a single perp leg."
- "No generic on-chain vault tokenization is implemented."

These remain TRUE and should NOT be removed until actually implemented.

## Gap Analysis

| Component | Status | Gap | Priority |
|-----------|--------|-----|----------|
| Ranger SDK | ❌ Missing | No SDK access/integration | Critical |
| Ranger Vault Factory | ❌ Missing | No on-chain vault creation | Critical |
| Solana Vault Program | ❌ Missing | No program IDL/implementation | Critical |
| Share Token Mint/Burn | ❌ Missing | No SPL token integration | Critical |
| Mainnet Execution | ❌ Partial | Adapter exists, not execution-capable | Critical |
| Multi-Leg Orchestration | ❌ Missing | Spot+perp coordination not wired | High |
| CEX API Verification | ❌ Missing | Only CSV import exists | High |
| Realized APY Tracking | ⚠️ Partial | Schema exists, not fully wired | Medium |

## Implementation Strategy

Given external blockers (Ranger SDK availability), the approach will be:

1. **Create Ranger Integration Boundary**
   - Add `packages/ranger/` package as integration layer
   - Define interfaces for vault factory, strategy adapter
   - Document exact external blocker if SDK unavailable
   - Wire into existing runtime/carry/treasury hooks

2. **Implement Vault Program Abstraction**
   - Create vault program interface (can work with Ranger OR internal)
   - Add deposit/withdrawal flow
   - Implement share accounting (SPL token or internal)
   - Surface on-chain addresses for submission

3. **Enable Mainnet Execution**
   - Complete `DriftMainnetCarryAdapter` execution path
   - Add proper key management
   - Maintain heavy gating (promotion, circuit breakers)

4. **Integrate Multi-Leg Coordination**
   - Wire `spot-perp-coordination.ts` into execution flow
   - Add hedge state tracking
   - Implement rebalance logic

## Files to Modify/Create

### New Files
```
packages/ranger/
  src/
    index.ts
    types.ts
    vault-client.ts
    strategy-adapter.ts
    factory-client.ts
  package.json
  tsconfig.json

packages/vault-program/
  src/
    index.ts
    types.ts
    instructions.ts
    accounts.ts
  OR integrate into packages/ranger if using Ranger's program

packages/db/src/migrations/0026_ranger_vault_integration.sql
packages/db/src/schema/ranger.ts
```

### Modified Files
```
apps/api/src/routes/vault.ts          # Add on-chain address endpoints
apps/api/src/routes/submission.ts      # Enhance with address verification
apps/ops-dashboard/app/vault/          # Add on-chain visibility
packages/venue-adapters/src/real/drift-mainnet-carry-adapter.ts  # Enable execution
README.md                              # Update only truthfully
```

## Validation Criteria

- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] New ranger package has tests
- [ ] Vault on-chain address surfaced in API
- [ ] Mainnet execution path exists (even if gated)
- [ ] README disclaimers updated truthfully

## Next Steps

1. Create `packages/ranger` with integration interfaces
2. Implement vault program abstraction
3. Complete mainnet execution adapter
4. Add persistence and API surfaces
5. Add operator UI
6. Update documentation
