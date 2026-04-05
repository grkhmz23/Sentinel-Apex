# Performance Report Generation Runbook

## Purpose

This runbook describes how to generate truthful, exportable performance reports for hackathon submission.

## Report Types

### JSON Report
Machine-readable format for programmatic analysis.

Use when:
- Integrating with external systems
- Custom analysis needed
- Automated verification

### Markdown Report
Human-readable format with tables and explanations.

Use when:
- Judge review required
- GitHub/documentation display
- Printable format needed

## Generating Reports

### Via Dashboard

Navigate to **Submission** → **Performance Reports** section:

1. Click "Generate Report"
2. Enter report name
3. Select date range
4. Choose format (JSON/Markdown)
5. Check optional inclusions:
   - Multi-leg execution detail
   - Hedge state history
   - Vault activity summary
6. Submit

### Via API

```bash
# Generate markdown report
curl -X POST /api/v1/submission/report \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Hackathon Build Week Performance",
    "format": "markdown",
    "dateRangeStart": "2026-04-01T00:00:00Z",
    "dateRangeEnd": "2026-04-07T23:59:59Z",
    "includeMultiLegDetail": true,
    "includeHedgeState": true,
    "includeVaultActivity": false,
    "notes": "First week of hackathon submissions"
  }'
```

Response:
```json
{
  "data": {
    "reportId": "report-xxx",
    "reportName": "Hackathon Build Week Performance",
    "status": "complete",
    "format": "markdown",
    "dateRangeStart": "2026-04-01T00:00:00Z",
    "dateRangeEnd": "2026-04-07T23:59:59Z",
    "generatedAt": "2026-04-07T12:00:00Z",
    "generatedBy": "operator-xxx",
    "metadata": {
      "label": "Hackathon Build Week Performance",
      "description": "First week of hackathon submissions",
      "executionTypes": ["devnet"],
      "dataCompleteness": "partial",
      "missingData": ["realized-pnl"]
    },
    "summary": {
      "totalExecutions": 15,
      "realExecutions": 10,
      "simulatedExecutions": 5,
      "totalNotionalUsd": "150000.00",
      "realizedPnlUsd": null,
      "realizedApyPct": "12.5",
      "averageHedgeDeviationPct": "0.85"
    },
    "multiLegSummary": {
      "totalPlans": 8,
      "completedPlans": 7,
      "partialPlans": 1,
      "failedPlans": 0,
      "totalLegs": 16,
      "completedLegs": 15,
      "averageLegCompletionPct": "93.75"
    },
    "content": "# Hackathon Build Week Performance\n...",
    "downloadUrl": null,
    "expiresAt": "2026-07-06T12:00:00Z",
    "createdAt": "2026-04-07T12:00:00Z"
  }
}
```

## Report Content

### Executive Summary

Every report includes:
- Total executions (real + simulated)
- Total notional traded
- Realized APY (if available)
- Average hedge deviation (if multi-leg)

### Execution Breakdown

Real vs. simulated:
```
Real Executions:    10
Simulated:           5
Total:              15
```

### Multi-Leg Performance

If enabled:
- Plans by status (completed/partial/failed)
- Leg completion rate
- Hedge deviation statistics

### Data Completeness

Explicit statement:
```
Status: partial
Missing: realized-pnl, mainnet-executions
```

## Understanding Truth Labels

### Execution Type Indicators

Reports include metadata.executionTypes:

| Type | Meaning | Submission Value |
|------|---------|------------------|
| `devnet` | Live execution on devnet | High |
| `simulated` | Mock venue execution | Medium (demonstrates strategy) |
| `backtest` | Historical simulation | Low |

### Data Completeness Levels

| Level | Description | Action |
|-------|-------------|--------|
| `complete` | All expected data present | Ready for submission |
| `partial` | Core metrics present, some gaps | Acceptable with notes |
| `minimal` | Significant gaps | Add more evidence |

## Retrieving Reports

### List All Reports

```bash
curl /api/v1/submission/reports?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

### Get Specific Report

```bash
curl /api/v1/submission/report/report-xxx \
  -H "Authorization: Bearer $TOKEN"
```

For Markdown reports, content is returned as a string:
```json
{
  "content": "# Report Name\n\n**Date Range:** ..."
}
```

## Markdown Report Format

Standard sections:

1. **Header**: Report name, date range, generation time
2. **Executive Summary**: Key metrics table
3. **Execution Types**: List of execution environments used
4. **Multi-Leg Summary**: Plan/leg statistics (if included)
5. **Data Completeness**: Status and missing data list
6. **Truthfulness Notice**: Explanation of execution type distinctions

Example:
```markdown
# Week 1 Performance Report

**Date Range:** 2026-04-01 to 2026-04-07
**Generated:** 2026-04-07T12:00:00Z

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Executions | 15 |
| Real Executions | 10 |
| Simulated Executions | 5 |
| Total Notional (USD) | $150000.00 |
| Realized APY | 12.5% |

## Execution Types

- devnet

## Data Completeness

**Status:** partial

### Missing Data

- realized-pnl

## Truthfulness Notice

This report distinguishes between:
- **Real/devnet executions**: Executed against live venues on devnet
- **Simulated executions**: Executed against simulated venues
- **Backtests**: Historical simulations

Any missing data is explicitly listed above.
```

## Best Practices

### Date Ranges

- Align with build window
- Include at least 24 hours of activity
- Don't overlap reports unnecessarily

### Naming

- Use descriptive names: "Week 1 - BTC Carry"
- Include date reference: "April 1-7 Performance"
- Avoid generic names: "Report 1"

### Inclusions

Always include multi-leg detail when:
- Delta-neutral trades executed
- Hedge deviation tracking relevant
- Demonstrating sophisticated execution

### Notes

Add context in notes field:
- Market conditions
- Strategy adjustments
- Known limitations

## Common Issues

### "No executions in date range"

Check:
- Date range correct (timezone?)
- Executions exist in system
- Date format ISO 8601

### "Realized APY unavailable"

APY requires:
- Multiple closed trades
- Sufficient time period
- PnL data persistence

With insufficient data:
- Report generates successfully
- APY shown as null
- Listed in missingData

### "All executions simulated"

To get real executions:
- Configure devnet venues
- Disable simulation mode
- Execute against live order books

## Report Expiration

Reports expire after 90 days:
- `expiresAt` field set on creation
- Expired reports remain in list
- Content still accessible
- Regenerate if needed for submission

## Audit Trail

Every report generation is audited:
- Actor who generated
- Timestamp
- Input parameters
- Report ID

View in audit logs:
```bash
curl /api/v1/audit?eventType=vault.performance_report_generated
```
