# Connector Promotion Rules

Date: 2026-04-02

## Objective

These rules define when a connector may be requested for promotion, approved for live use, suspended, or blocked from sensitive execution.

The rules are enforced in backend runtime/control-plane logic. They are not advisory UI-only checks.

## Rule Set

### 1. Capability Is Not Approval

- `simulated_only` connectors are never live-promotion candidates.
- `real_readonly` connectors are never sensitive-execution candidates.
- only `execution_capable` connectors can enter the live-promotion workflow.

### 2. Promotion Must Be Explicit

- no connector is auto-promoted from snapshot metadata
- no connector is auto-approved because it has real truth
- promotion requires an explicit operator request
- approval, rejection, and suspension require explicit operator action and durable persistence

### 3. Approval Requires Current Eligible Evidence

Approval is blocked unless current connector evidence is eligible.

Current eligibility requires:

- execution-capable connector class
- fresh latest truth snapshot
- healthy latest truth state
- sufficient snapshot completeness
- sufficient read-only validation coverage
- no missing prerequisites that the repo currently knows about

### 4. Approval Does Not Bypass Current Evidence

- `approved` records remain durable
- current sensitive execution is still blocked when evidence later becomes stale, degraded, unavailable, or incomplete
- current runtime gating uses eligibility, not historical approval alone

### 5. Rejected And Suspended Connectors Are Hard-Blocked

- `rejected` connectors cannot be used for sensitive execution
- `suspended` connectors cannot be used for sensitive execution
- suspension exists so operators can invalidate prior approval without deleting history

### 6. Read-Only Truth Is Validation Input, Not Execution Permission

- real read-only snapshots may support promotion review
- they do not grant execution approval by themselves
- execution capability and operator approval remain separate requirements

### 7. Unknown External Process State Is Not Assumed Complete

The backend only reasons over evidence it can actually see:

- persisted connector truth
- persisted missing prerequisites
- persisted config markers
- persisted promotion history

The backend does not assume external runbooks, onboarding tickets, or secret handling have completed unless those are modeled explicitly in persisted evidence.

## Transition Controls

- request promotion:
  - operator or admin
  - execution-capable only
  - not already approved
  - not already pending review
- approve promotion:
  - admin only
  - current status must be `pending_review`
  - current evidence must be eligible
- reject promotion:
  - admin only
  - current status must be `pending_review`
  - note required
- suspend promotion:
  - admin only
  - current status must be `approved`
  - note required

## Execution Gating

Carry and treasury sensitive execution are blocked when connector promotion truth fails one of these checks:

- connector is not execution-capable
- connector is not approved
- connector is rejected or suspended
- connector is approved but currently ineligible

Blocked reasons are persisted and returned to operators through API and dashboard surfaces.

## Operator Interpretation

- `promotionStatus=approved`
  - historical decision exists
- `sensitiveExecutionEligible=false`
  - current runtime still blocks live use
- `blockers.length > 0`
  - operators have concrete evidence to resolve before retrying or re-approving

## Current Boundary

Phase 5.9 adds the promotion workflow and truth-backed gating model.

It does not:

- approve any current real connector for live execution
- infer approval from read-only Drift truth
- remove the dry-run/simulated default posture
