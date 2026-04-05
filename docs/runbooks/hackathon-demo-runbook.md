# Sentinel Apex — Hackathon Devnet Demo Runbook

**Version:** 1.0  
**Date:** 2026-04-05  
**Purpose:** Reproducible devnet demo flow for Build-A-Bear hackathon submission

---

## Prerequisites Checklist

Before starting the demo, verify all prerequisites are met:

### Environment
- [ ] Node.js 20+ installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] Docker running (for PostgreSQL)
- [ ] Git repo cloned and dependencies installed (`pnpm install`)

### Database
- [ ] PostgreSQL container running (`pnpm db:start`)
- [ ] Database migrations applied (`pnpm db:migrate`)
- [ ] Database health check passes (`pnpm db:health`)

### Solana Devnet
- [ ] Devnet wallet with SOL for gas
  - Get devnet SOL from: https://faucet.solana.com/
  - Minimum 2 SOL recommended
- [ ] Devnet wallet private key exported as environment variable
- [ ] Drift devnet account created

### Environment Variables
Create a `.env.local` file with:

```bash
# Database
DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex

# API Secrets
API_SECRET_KEY=your-at-least-32-character-secret-key
OPS_AUTH_SHARED_SECRET=your-at-least-32-character-secret-key

# Execution Mode
EXECUTION_MODE=live
FEATURE_FLAG_LIVE_EXECUTION=true

# Drift Devnet Configuration
DRIFT_RPC_ENDPOINT=https://api.devnet.solana.com
DRIFT_READONLY_ENV=devnet
DRIFT_EXECUTION_ENV=devnet
DRIFT_PRIVATE_KEY=your-devnet-wallet-private-key-base58
DRIFT_EXECUTION_SUBACCOUNT_ID=0
DRIFT_EXECUTION_ACCOUNT_LABEL="Hackathon Devnet Demo"

# Optional: Mainnet read-only for comparison
DRIFT_READONLY_ENV_MAINNET=mainnet-beta
DRIFT_READONLY_ACCOUNT_ADDRESS_MAINNET=your-mainnet-readonly-address
```

---

## Demo Scenario Overview

**Scenario:** Delta-Neutral Carry Trade on BTC-PERP

**Flow:**
1. Start API and worker
2. Verify environment and connectors
3. Check submission dossier status
4. (Optional) Run backtest for strategy validation
5. Review carry recommendations
6. Execute a carry action on devnet
7. Verify execution on-chain
8. Generate submission export bundle

**Expected Duration:** 10-15 minutes

---

## Step-by-Step Demo

### Step 1: Start Services

Terminal 1 - Start API:
```bash
pnpm --filter @sentinel-apex/api dev
```

Terminal 2 - Start Worker:
```bash
pnpm --filter @sentinel-apex/runtime-worker dev
```

Terminal 3 - Start Ops Dashboard (optional):
```bash
PORT=3100 pnpm --filter @sentinel-apex/ops-dashboard dev
```

Wait for all services to initialize (look for "ready" messages).

### Step 2: Environment Validation

Run the validation script:
```bash
pnpm validate
```

Expected: All checks pass (build, typecheck, lint).

### Step 3: Health Check

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}`

### Step 4: Authenticate

Login as operator:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "role": "operator",
    "id": "demo-operator",
    "signature": "demo-signature"
  }'
```

Save the returned token as `TOKEN` environment variable:
```bash
export TOKEN="your-returned-token"
```

### Step 5: Check Submission Dossier

```bash
curl http://localhost:3000/api/v1/submission \
  -H "Authorization: Bearer $TOKEN"
```

Review the response:
- `readiness.status` shows current submission state
- `artifactChecklist` shows which items are complete
- Any `blockedReasons` indicate missing requirements

### Step 6: (Optional) Run Backtest

Validate strategy with historical simulation:

```bash
curl -X POST http://localhost:3000/api/v1/backtest/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backtestId": "demo-btc-carry-1",
    "name": "BTC Carry Demo Backtest",
    "period": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-31T00:00:00Z"
    },
    "assets": ["BTC"],
    "initialCapitalUsd": "100000",
    "saveAsEvidence": true
  }'
```

Wait for completion (up to 60 seconds). Note the `runId` in the response.

**Expected:** Results showing simulated performance with clear caveats about synthetic data.

### Step 7: Review Carry Recommendations

```bash
curl http://localhost:3000/api/v1/carry/recommendations \
  -H "Authorization: Bearer $TOKEN"
```

Review the recommendations:
- Look for actionable recommendations
- Check opportunity scores
- Note any blocked actions and their reasons

### Step 8: Trigger Carry Evaluation (Optional)

Force a fresh evaluation:
```bash
curl -X POST http://localhost:3000/api/v1/carry/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

### Step 9: List Carry Actions

```bash
curl http://localhost:3000/api/v1/carry/actions \
  -H "Authorization: Bearer $TOKEN"
```

Find an action with status `recommended`.

### Step 10: Approve and Execute Carry Action

```bash
curl -X POST http://localhost:3000/api/v1/carry/actions/{actionId}/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": "demo-operator",
    "notes": "Hackathon demo execution"
  }'
```

Wait for execution (check action status):
```bash
curl http://localhost:3000/api/v1/carry/actions/{actionId} \
  -H "Authorization: Bearer $TOKEN"
```

Repeat until status is `completed` or `failed`.

### Step 11: Verify Execution On-Chain

Check the execution details:
```bash
curl http://localhost:3000/api/v1/carry/actions/{actionId}/executions \
  -H "Authorization: Bearer $TOKEN"
```

Look for:
- `transactionSignature` 
- `venueExecutionId`
- `confirmationStatus`

Verify on Solana devnet explorer:
https://explorer.solana.com/tx/{transactionSignature}?cluster=devnet

### Step 12: Record Execution Evidence

Add the execution as submission evidence:
```bash
curl -X POST http://localhost:3000/api/v1/submission/evidence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evidenceType": "on_chain_transaction",
    "label": "Devnet BTC-PERP Execution",
    "reference": "{transactionSignature}",
    "url": "https://explorer.solana.com/tx/{transactionSignature}?cluster=devnet",
    "summary": "Executed BTC-PERP carry trade on devnet",
    "withinBuildWindow": true,
    "metadata": {
      "actionId": "{actionId}",
      "executionId": "{executionId}"
    }
  }'
```

### Step 13: Update Submission Dossier

Set wallet/vault addresses:
```bash
curl -X POST http://localhost:3000/api/v1/submission \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "your-devnet-wallet-address",
    "vaultAddress": "your-vault-address-or-same-as-wallet",
    "notes": "Devnet demo submission - BTC-PERP carry execution"
  }'
```

### Step 14: Generate Export Bundle

```bash
curl http://localhost:3000/api/v1/submission/export \
  -H "Authorization: Bearer $TOKEN" \
  > submission-bundle.json
```

Review the bundle:
```bash
cat submission-bundle.json | jq '.artifactChecklist'
```

Expected: All required artifacts should show `"status": "pass"`.

### Step 15: Review in Dashboard

Open http://localhost:3100/submission in browser.

Review:
- Submission readiness indicators
- Evidence completeness
- Judge-facing summary

---

## Expected Artifacts

After successful demo, you should have:

1. **On-chain execution** - Transaction signature on devnet
2. **Execution record** - Recorded in runtime database
3. **Submission evidence** - Linked transaction evidence
4. **Submission dossier** - Updated with wallet/vault addresses
5. **Export bundle** - JSON file with all artifacts
6. **(Optional) Backtest results** - Historical simulation evidence

---

## Troubleshooting

### Build Failures
```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Database Issues
```bash
# Reset database
pnpm db:stop
pnpm db:start
pnpm db:migrate
```

### Execution Failures
Check worker logs for:
- Environment variable issues
- Drift connection errors
- Insufficient SOL balance

### No Recommendations
- Verify Drift readonly connector is healthy
- Check venue capability status
- Manually trigger evaluation

---

## Failure / Rollback Guidance

If demo fails at any point:

1. **Don't panic** - This is a devnet demo, no real funds at risk
2. **Check logs** - API and worker logs show detailed errors
3. **Verify prerequisites** - Re-run the checklist
4. **Reset if needed** - Can reset database and start over
5. **Document issues** - Note any blockers for judges

---

## Post-Demo Cleanup

Optional cleanup after demo:

```bash
# Stop services (Ctrl+C in each terminal)
# Stop database
pnpm db:stop
```

---

## Honest Limitations Statement

**What This Demo Shows:**
- Real devnet execution on Drift
- End-to-end trade lifecycle
- Submission evidence workflow
- Operator approval flow

**What This Demo Does NOT Show:**
- Mainnet execution (devnet only)
- Full delta-neutral hedging (perp leg only)
- Multi-asset execution (BTC only in demo)
- Production hardening

**For Hackathon Judges:**
This demo demonstrates a real execution path on devnet with proper
submission evidence workflow. The codebase shows production-ready
architecture with clear paths to mainnet and full strategy implementation.
