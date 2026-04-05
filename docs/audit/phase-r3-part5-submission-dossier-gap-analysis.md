# Phase R3 Part 5 - Submission Dossier Gap Analysis

## Audit Date
2026-04-05

## 1. Current Submission/Evidence State

### What Already Exists

#### API Layer (`apps/api/src/routes/submission.ts`)
- `GET /api/v1/submission` - Get submission dossier
- `POST /api/v1/submission` - Upsert submission dossier (operator)
- `GET /api/v1/submission/evidence` - List submission evidence
- `POST /api/v1/submission/evidence` - Record submission evidence (operator)
- `GET /api/v1/submission/export` - Get submission export bundle

#### Vault Routes (`apps/api/src/routes/vault.ts`)
- `GET /api/v1/vault` - Vault summary
- `GET /api/v1/vault/depositors` - List depositors
- `GET /api/v1/vault/deposits` - List deposit lots
- `GET /api/v1/vault/redemptions` - List redemption requests
- `POST /api/v1/vault/deposits` - Record deposit (operator)
- `POST /api/v1/vault/redemptions` - Request redemption (operator)

#### Store Layer (`packages/runtime/src/store.ts`)
- `getSubmissionDossier()` - Assembles dossier from vault, strategy, execution data
- `upsertSubmissionDossier()` - Updates dossier configuration
- `listSubmissionEvidence()` - Lists evidence records
- `recordSubmissionEvidence()` - Records new evidence
- `getSubmissionExportBundle()` - Builds exportable bundle
- `getVaultSummary()` - Vault state summary
- `listVaultDepositors()` - Depositor list
- `listVaultDepositLots()` - Deposit lots
- `listVaultRedemptionRequests()` - Redemption requests

#### Control Plane (`packages/runtime/src/control-plane.ts`)
- All submission methods delegated from store
- Audit trail for dossier/evidence changes

#### Types (`packages/runtime/src/types.ts`)
- `SubmissionDossierView` - Complete dossier structure
- `SubmissionEvidenceRecordView` - Evidence record
- `SubmissionExportBundleView` - Export bundle
- `SubmissionExportArtifactView` - Individual artifact check
- `UpsertSubmissionDossierInput` - Dossier update input
- `RecordSubmissionEvidenceInput` - Evidence input

#### Dashboard (`apps/ops-dashboard/app/submission/page.tsx`)
- Submission profile panel (track, readiness, strategy, vault, addresses)
- Readiness checks panel
- Supported scope panel
- Blocked scope panel
- Verification evidence panel
- Export bundle panel with artifact checklist

### What's Missing for Credible Submission Package

#### 1. Multi-Leg Execution Evidence Integration
**Status**: Infrastructure exists, not integrated into submission

- Multi-leg plans are persisted (`carryMultiLegPlans` table)
- Leg executions are tracked (`carryLegExecutions` table)
- Hedge state is recorded (`carryHedgeState` table)
- BUT: No query methods to aggregate multi-leg evidence for submission
- BUT: No multi-leg summary in dossier
- BUT: No hedge deviation reporting in export

**Required**:
- `listMultiLegExecutionsForSubmission()` query
- Multi-leg execution summary in dossier
- Hedge state/drift evidence in export bundle

#### 2. Performance Report Generation
**Status**: Not implemented

- Realized APY exists in strategy profile
- Execution counts exist (real vs simulated)
- BUT: No date-range configurable report
- BUT: No exportable JSON/CSV/Markdown performance artifact
- BUT: No PnL summary export

**Required**:
- `generatePerformanceReport()` method with date range
- Export formats: JSON, Markdown
- Clear labeling: executed/devnet/simulated/backtested
- Missing data visibility

#### 3. Evidence Completeness API
**Status**: Partial (exists in export bundle but not as standalone endpoint)

- Export bundle has artifact checklist
- BUT: No dedicated `/api/v1/submission/completeness` endpoint
- BUT: No missing evidence list API

**Required**:
- `GET /api/v1/submission/completeness` endpoint
- Explicit missing evidence list
- Blocker identification

#### 4. Performance Reporting API
**Status**: Not implemented

- No report generation endpoint
- No report retrieval endpoint

**Required**:
- `POST /api/v1/submission/report` - Generate report
- `GET /api/v1/submission/report/:reportId` - Get report
- `GET /api/v1/submission/reports` - List reports

#### 5. Dashboard Enhancements
**Status**: Basic page exists, missing key features

- No multi-leg execution evidence panel
- No performance report generation UI
- No export/download functionality
- No missing evidence drill-through

**Required**:
- Multi-leg evidence section
- Report generation form
- Export/download buttons
- Evidence completeness indicator

#### 6. Documentation
**Status**: Outdated/missing

- No submission dossier architecture doc
- No performance report runbook
- README doesn't reflect submission workflow

**Required**:
- `docs/architecture/phase-r3-submission-dossier.md`
- `docs/runbooks/submission-dossier.md`
- `docs/runbooks/performance-report-generation.md`
- README updates

## 2. Reusable Data Sources

### Vault/On-Chain Evidence
- `vaultCurrent` table - vault configuration, addresses
- `vaultDepositors` table - depositor list
- `vaultDepositLots` table - deposit history
- `vaultRedemptionRequests` table - redemption history

### Execution Evidence
- `carryActionExecutions` table - execution records
- `carryExecutionSteps` table - execution steps
- `carryMultiLegPlans` table - multi-leg plans
- `carryLegExecutions` table - leg execution details
- `carryHedgeState` table - hedge deviation tracking

### Strategy Evidence
- `carryStrategyProfile` - strategy configuration
- Realized APY tracking
- Environment configuration (devnet/mainnet/simulated)

### Connector Evidence
- `carryVenues` table - venue registration
- `venueTruthSnapshots` table - venue truth data
- Promotion status tracking

### Risk/Guardrail Evidence
- `carryGuardrailConfig` table - guardrail settings
- `carryGuardrailViolations` table - violation history
- Kill switch state

## 3. Implementation Plan (Priority Order)

### Step 1: Multi-Leg Evidence Query Layer
**Files**: `packages/runtime/src/store.ts`, `packages/runtime/src/control-plane.ts`

Add methods:
- `listMultiLegExecutionsForDateRange(start, end)` - Aggregate multi-leg data
- `getHedgeStateSummary(start, end)` - Hedge deviation statistics
- `getMultiLegExecutionEvidence()` - Evidence-compatible format

### Step 2: Performance Report Generation
**Files**: `packages/runtime/src/store.ts`, `packages/runtime/src/types.ts`

Add:
- `generatePerformanceReport(input: GeneratePerformanceReportInput)` - Report creation
- `getPerformanceReport(reportId)` - Report retrieval
- `listPerformanceReports(limit)` - Report listing
- `PerformanceReportView` type

### Step 3: Completeness API
**Files**: `apps/api/src/routes/submission.ts`

Add endpoint:
- `GET /api/v1/submission/completeness`

Returns:
- Completeness percentage
- Missing evidence list
- Blocker flags
- Recommended actions

### Step 4: Performance Report API
**Files**: `apps/api/src/routes/submission.ts`

Add endpoints:
- `POST /api/v1/submission/report` - Generate report
- `GET /api/v1/submission/reports` - List reports
- `GET /api/v1/submission/report/:reportId` - Get report

### Step 5: Dashboard Enhancements
**Files**: `apps/ops-dashboard/app/submission/page.tsx`, new components

Add:
- Multi-leg execution evidence section
- Report generation form (date range, format)
- Export buttons (JSON, Markdown)
- Completeness progress indicator
- Missing evidence warnings

### Step 6: Documentation
**Files**: New docs, README updates

Create:
- `docs/architecture/phase-r3-submission-dossier.md`
- `docs/runbooks/submission-dossier.md`
- `docs/runbooks/performance-report-generation.md`
- Update README.md

## 4. Export/Report Formats

### JSON Export (Machine-Readable)
```json
{
  "generatedAt": "2026-04-05T...",
  "dossier": { /* full dossier */ },
  "evidence": { /* evidence by category */ },
  "multiLegExecutions": { /* aggregated multi-leg data */ },
  "performance": { /* PnL, APY, execution stats */ },
  "metadata": {
    "truthLabels": ["devnet-executed", "simulated"],
    "missingData": ["mainnet-executions", "realized-pnl"]
  }
}
```

### Markdown Report (Human-Readable)
- Executive summary
- Execution evidence table
- Multi-leg performance summary
- Hedge deviation report
- Vault/depositor summary
- Verification links
- Missing data disclaimer

### CSV Export (Tabular)
- Executions list
- Leg executions list
- Hedge state history
- Depositor list

## 5. Truthfulness Requirements

Every export/report MUST clearly label:

1. **Execution Environment**
   - `devnet` - Executed on devnet
   - `simulated` - Executed against simulated venues
   - `read-only` - Read-only truth snapshots
   - `backtest` - Historical simulation

2. **Data Completeness**
   - Explicit list of missing evidence
   - Blockers for Main Track submission
   - Partial data warnings

3. **Verification Status**
   - On-chain references with links
   - CEX verification status
   - Connector promotion status

## 6. Blockers for Main Track

Based on current implementation:

1. **Mainnet Execution Evidence** - Currently devnet only
2. **Realized PnL Persistence** - APY calculated but PnL not persisted
3. **CEX Verification** - Optional but needs explicit status
4. **Multi-Leg Evidence Integration** - Infrastructure exists, not wired to submission

---

## Next Steps

1. Implement multi-leg evidence query methods
2. Implement performance report generation
3. Add completeness API endpoint
4. Add report generation API endpoints
5. Enhance dashboard with multi-leg and reporting UI
6. Create documentation
