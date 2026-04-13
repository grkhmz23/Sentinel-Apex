# Submission Dossier Runbook

## Purpose

This runbook describes how to prepare a hackathon submission using the Sentinel Apex submission dossier system.

## Prerequisites

- Operator access to the ops dashboard
- Vault configured with strategy
- At least one execution in the build window

## Step-by-Step Guide

### 1. Configure Vault Addresses

Navigate to **Submission** page in ops dashboard.

Verify/configure:
- Wallet address (manager wallet)
- Vault address (program address)

Or via API:
```bash
curl -X POST /api/v1/submission \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "walletAddress": "0x...",
    "vaultAddress": "0x..."
  }'
```

### 2. Set Verification Window

Define the evidence verification window used for on-chain and performance review.

Hackathon dates reflected in the current submission flow:
- Verification / build window: March 9, 2026 through April 6, 2026
- Submission deadline: April 17, 2026 at 15:59 UTC

```bash
curl -X POST /api/v1/submission \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "buildWindowStart": "2026-03-09T00:00:00Z",
    "buildWindowEnd": "2026-04-06T23:59:59Z"
  }'
```

### 3. Execute Trades

Run carry strategy within build window:
- Real executions count toward submission
- Simulated executions are tracked separately
- Multi-leg executions provide delta-neutral evidence

### 4. Check Completeness

Review what's missing:

```bash
curl /api/v1/submission/completeness \
  -H "Authorization: Bearer $TOKEN"
```

Response shows:
- Overall completeness percentage
- Category-by-category status
- Missing evidence list
- Blockers preventing submission

### 5. Generate Performance Report

Create exportable report:

```bash
curl -X POST /api/v1/submission/report \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reportName": "Week 1 Performance",
    "format": "markdown",
    "dateRangeStart": "2026-03-09T00:00:00Z",
    "dateRangeEnd": "2026-04-06T23:59:59Z",
    "includeMultiLegDetail": true,
    "includeHedgeState": true
  }'
```

Available formats:
- `json` - Machine-readable
- `markdown` - Human-readable with tables
- `csv` - Tabular data (future)

### 6. Record Multi-Leg Evidence

If delta-neutral trades executed, record as evidence:

```bash
curl -X POST /api/v1/submission/multi-leg-evidence \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "planId": "plan-xxx",
    "evidenceLabel": "BTC delta-neutral entry",
    "includeHedgeState": true
  }'
```

### 7. Add Explicit Evidence (Optional)

Record additional verification:

```bash
curl -X POST /api/v1/submission/evidence \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "evidenceType": "on_chain_transaction",
    "label": "Initial deposit",
    "reference": "tx-signature",
    "url": "https://solscan.io/tx/...",
    "capturedAt": "2026-03-20T12:00:00Z"
  }'
```

### 8. Export Submission Bundle

Get judge-ready package:

```bash
curl /api/v1/submission/export \
  -H "Authorization: Bearer $TOKEN"
```

This includes:
- Complete dossier
- All evidence
- Artifact checklist
- Judge summary
- Verification links

### 9. Review Dashboard

Navigate to **Submission** page to visually confirm:
- ✅ Readiness checks passing
- ✅ Real executions recorded
- ✅ Evidence attached
- ✅ No blockers

## Troubleshooting

### "No real executions recorded"

Check execution mode:
- Simulated venues don't count as real
- Use devnet venues for real execution
- Verify `simulated: false` in execution records

### "Vault address not configured"

Set vault address in dossier:
```bash
curl -X POST /api/v1/submission \
  -d '{"vaultAddress": "0x..."}'
```

### "Strategy not eligible"

Check strategy profile:
```bash
curl /api/v1/carry/strategy-profile
```

Resolve blocked reasons before submission.

### "Realized APY unavailable"

APY requires:
- Multiple trades over time
- Closed positions with PnL
- Sufficient data for calculation

## Truthfulness Requirements

### Execution Type Labels

Every report MUST clearly label:

| Label | Meaning |
|-------|---------|
| `devnet` | Executed on devnet against live venues |
| `simulated` | Executed against simulated/mock venues |
| `backtest` | Historical simulation |
| `read-only` | Truth snapshot only, no execution |

### Data Completeness

Reports indicate:
- **complete**: All expected data available
- **partial**: Some data missing but core metrics present
- **minimal**: Significant data gaps

Missing data is explicitly listed - never hidden.

## Checklist for Submission

Before submitting to hackathon:

- [ ] Wallet address configured
- [ ] Vault address configured
- [ ] Build window defined
- [ ] Real executions in window
- [ ] On-chain references recorded
- [ ] Performance report generated
- [ ] Completeness check > 80%
- [ ] No blockers
- [ ] Export bundle downloaded
- [ ] Verification links tested

## API Reference

### Get Dossier
```
GET /api/v1/submission
```

### Update Dossier
```
POST /api/v1/submission
Body: UpsertSubmissionDossierInput
```

### List Evidence
```
GET /api/v1/submission/evidence
```

### Record Evidence
```
POST /api/v1/submission/evidence
Body: RecordSubmissionEvidenceInput
```

### Get Completeness
```
GET /api/v1/submission/completeness
```

### Generate Report
```
POST /api/v1/submission/report
Body: GeneratePerformanceReportInput
```

### List Reports
```
GET /api/v1/submission/reports?limit=50
```

### Get Report
```
GET /api/v1/submission/report/:reportId
```

### Record Multi-Leg Evidence
```
POST /api/v1/submission/multi-leg-evidence
Body: RecordMultiLegEvidenceInput
```

### Export Bundle
```
GET /api/v1/submission/export
```

## Support

For issues:
1. Check audit logs for errors
2. Verify all prerequisites
3. Review completeness assessment
4. Contact system admin if blockers unclear
