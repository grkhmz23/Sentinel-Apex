# Phase 3.2 Treasury Operator Gap Analysis

Date: 2026-03-21
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Treasury Operator Workflow

Before Phase 3.2, Atlas Treasury operators could:

- inspect treasury summary, policy, allocations, recommendations, and execution history
- approve actionable treasury actions
- queue treasury execution through the existing runtime command rail
- inspect action status and free-form blocked reason text from the dashboard table

That workflow was operationally useful, but still shallow.

## 2. Missing Drill-Through And Audit Surfaces

Gaps before this pass:

- no dedicated treasury action detail surface
- no treasury execution detail page with linked command, venue, and timeline context
- no action-scoped approval/execution timeline
- no clean navigation from recommendation -> action -> execution -> venue
- blocked reasons were present but not sufficiently structured for operator guidance
- venue capability and connector readiness data existed in adapters/planning, but was not exposed as a first-class operator view

## 3. Missing Venue Readiness / Onboarding Visibility

Gaps before this pass:

- no venue inventory view for treasury connectors
- no venue detail read model for live-readiness posture
- no surfaced distinction between:
  - simulated
  - real read-only
  - execution-capable
  - approved for live use
- no documented operator runbook for onboarding a real treasury connector
- no explicit live-enable checklist for treasury operator signoff

## 4. Required Changes

### API / Read Models

- extend treasury action detail with:
  - timeline
  - linked venue metadata
  - latest summary and policy context
- add treasury execution detail with:
  - linked action
  - linked runtime command
  - linked venue
  - timeline
- add venue inventory and venue detail read surfaces

### Structured Policy Explanations

- enrich blocked reasons with:
  - category
  - operator guidance
- expose these in read models so the dashboard can render practical operator guidance instead of opaque text

### Dashboard

- add treasury action detail page
- add treasury execution detail page
- add treasury venues inventory page
- add treasury venue detail page
- improve navigation from the main treasury page and action table

### Documentation

- add Phase 3.2 architecture note
- update treasury strategy status to include operator workflow depth
- add connector onboarding runbook
- add treasury live-enable checklist

## 5. Implementation Plan In Priority Order

1. Extend treasury blocked reasons and venue capability metadata so read surfaces are structured and operator-usable.
2. Extend runtime/control-plane/store read models for treasury action detail, execution detail, and venue readiness/detail.
3. Expose the new surfaces through thin treasury API routes.
4. Add dashboard drill-through pages and structured blocked-reason/timeline rendering.
5. Document connector onboarding requirements and treasury live-enable operator checklist.
6. Add deterministic API and dashboard tests for the new operator workflow.
