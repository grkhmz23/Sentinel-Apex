# Phase R3 Submission Dossier Architecture

## Overview

The submission dossier system provides a hackathon-ready evidence workflow for producing credible, verifiable submission packages. It aggregates vault state, execution history, multi-leg evidence, and performance metrics into exportable artifacts.

## Core Principles

1. **Truthfulness First**: Every report clearly distinguishes between:
   - Real devnet execution
   - Simulated execution
   - Read-only truth
   - Backtest/historical data
   - Missing/unavailable data

2. **Evidence-Based**: All claims are backed by persisted records, not fabricated metrics
3. **Completeness Tracking**: Explicit tracking of what's present vs. what's missing
4. **Audit Trail**: All dossier/evidence changes are audited

## Data Model

### Submission Dossier (`vault_submission_profiles`)

The central record describing the submission:

- `submissionName`: Human-readable name
- `track`: 'build_a_bear_main' | 'drift_side_track'
- `buildWindowStart/End`: Date range for evidence
- `cluster`: 'mainnet' | 'devnet' | 'unknown'
- `walletAddress`/`vaultAddress`: On-chain addresses
- `cexExecutionUsed`: Whether CEX venues were used
- `cexTradeHistoryProvided`: Whether trade history is available
- `cexReadOnlyApiKeyProvided`: Whether API verification is available

### Submission Evidence (`vault_submission_evidence`)

Explicit evidence attachments:

- `evidenceType`: 'on_chain_transaction' | 'performance_snapshot' | 'cex_trade_history' | 'cex_read_only_api'
- `status`: 'recorded' | 'verified' | 'rejected'
- `reference`: Transaction signature or identifier
- `url`: Link to evidence
- `withinBuildWindow`: Whether evidence falls in build window

### Performance Reports (`performance_reports`)

Generated performance artifacts:

- `reportName`: Human-readable name
- `format`: 'json' | 'markdown' | 'csv'
- `dateRangeStart/End`: Report period
- `summary`: Aggregated metrics (execution counts, notional, APY)
- `multiLegSummary`: Multi-leg specific metrics
- `content`: Report payload
- `metadata`: Truth labels, data completeness, missing data list

### Multi-Leg Evidence Summary (`multi_leg_evidence_summary`)

Pre-computed multi-leg execution evidence:

- `planId`: Reference to carryMultiLegPlans
- `asset`: Traded asset
- `notionalUsd`: Total notional
- `legCount`: Number of legs
- `hedgeDeviationPct`: Final hedge deviation
- `isWithinTolerance`: Whether deviation was acceptable
- `evidenceStatus`: 'pending' | 'confirmed' | 'rejected'

## API Surface

### Dossier Management

```
GET    /api/v1/submission              # Get dossier
POST   /api/v1/submission              # Update dossier (operator)
GET    /api/v1/submission/evidence     # List evidence
POST   /api/v1/submission/evidence     # Record evidence (operator)
GET    /api/v1/submission/export       # Get export bundle
```

### Completeness (R3 Part 5)

```
GET    /api/v1/submission/completeness # Get completeness assessment
```

Returns:
- Overall completeness percentage
- Category-by-category breakdown
- Missing evidence list
- Blockers for submission
- Warnings

### Performance Reports (R3 Part 5)

```
POST   /api/v1/submission/report       # Generate report (operator)
GET    /api/v1/submission/reports      # List reports
GET    /api/v1/submission/report/:id   # Get specific report
```

Report generation options:
- Date range selection
- Format selection (JSON/Markdown)
- Include multi-leg detail
- Include hedge state
- Include vault activity

### Multi-Leg Evidence (R3 Part 5)

```
POST   /api/v1/submission/multi-leg-evidence  # Record ML evidence (operator)
```

Captures a multi-leg plan as submission evidence with:
- Leg execution details
- Hedge state at completion
- Verification labels

## Export Bundle

The export bundle (`GET /api/v1/submission/export`) produces a judge-ready package:

```typescript
{
  generatedAt: string;
  dossier: SubmissionDossierView;
  evidence: SubmissionEvidenceRecordView[];
  artifactChecklist: SubmissionExportArtifactView[];
  judgeSummary: string;
  blockedReasons: string[];
  verificationLinks: string[];
}
```

### Artifact Checklist

Each required artifact is checked:

1. **Vault Identity**: Wallet + vault addresses configured
2. **Strategy Config**: Eligible strategy, environment documented
3. **Execution Evidence**: Real executions in build window
4. **Multi-Leg Evidence**: Delta-neutral execution proof
5. **Performance Metrics**: Realized APY, PnL where available
6. **CEX Verification**: Trade history/API if applicable

## Readiness Calculation

Submission readiness is computed by `buildSubmissionReadiness()`:

```
ready    = All required checks pass
partial  = Some required checks pass, no blockers
blocked  = Required check fails or explicit blocker
```

Factors:
- Address scope (wallet/vault configured)
- Execution environment (devnet vs mainnet)
- Real execution count in build window
- On-chain evidence count
- Strategy eligibility
- CEX verification (if applicable)

## Performance Report Generation

Reports are generated with explicit truth labels:

### Metadata Structure

```typescript
{
  label: string;
  description: string;
  executionTypes: ('real' | 'devnet' | 'simulated' | 'backtest')[];
  dataCompleteness: 'complete' | 'partial' | 'minimal';
  missingData: string[];
}
```

### Markdown Report Format

```markdown
# Report Name

**Date Range:** start to end
**Generated:** timestamp

## Executive Summary
| Metric | Value |
|--------|-------|
| Total Executions | N |
| Real Executions | N |
...

## Execution Types
- devnet
- simulated

## Data Completeness
**Status:** partial

### Missing Data
- realized-pnl
- mainnet-executions

## Truthfulness Notice
This report distinguishes between:
- **Real/devnet executions**: ...
- **Simulated executions**: ...
...
```

## Dashboard Integration

The submission page (`/submission`) provides:

1. **Submission Profile**: Core dossier information
2. **Readiness Checks**: Pass/warning status for each requirement
3. **Supported Scope**: What the repo can truthfully support
4. **Blocked Scope**: What's blocking Main Track submission
5. **Verification Evidence**: Explicit evidence attachments
6. **Export Bundle**: Artifact checklist with status

## Implementation Boundaries

### What's Implemented

- ✅ Dossier CRUD
- ✅ Evidence recording
- ✅ Export bundle generation
- ✅ Readiness calculation
- ✅ Completeness assessment
- ✅ Performance report generation (JSON/Markdown)
- ✅ Multi-leg evidence recording
- ✅ API endpoints
- ✅ Dashboard page

### What's Partial

- ⚠️ Mainnet execution evidence (devnet only currently)
- ⚠️ Realized PnL (tracked but not fully integrated)
- ⚠️ CEX verification (optional, not required)

### What's Blocked

- ⛔ None - system is functional for devnet submissions

## Usage Flow

### For Operators

1. Configure vault addresses in dossier
2. Execute trades during build window
3. Record explicit evidence as needed
4. Generate performance report
5. Review completeness assessment
6. Export submission bundle for judges

### For Judges

1. Access `/api/v1/submission/export`
2. Verify addresses on Solscan
3. Check execution references
4. Review performance report
5. Confirm evidence authenticity

## Future Enhancements

- Mainnet execution support
- Automated evidence capture
- Historical report comparison
- Custom report templates
- External verifier integration
