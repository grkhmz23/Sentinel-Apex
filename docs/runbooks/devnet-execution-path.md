# Devnet Execution Path

**Status:** DISABLED

---

## ⚠️ Important Notice

The devnet execution path via Drift protocol has been **removed** due to hackathon eligibility requirements. The Drift protocol was compromised and strategies using Drift are disqualified from prize consideration.

---

## Current State

- **All live execution is disabled**
- **Only simulation mode is available**
- **Backtesting framework is the primary validation method**

---

## What Was Removed

The following components were removed from the codebase:

1. `DriftDevnetCarryAdapter` - Devnet carry execution adapter
2. `DriftReadonlyTruthAdapter` - Drift truth adapter
3. `DriftMainnetCarryAdapter` - Mainnet carry adapter
4. `DriftSpotAdapter` - Spot market adapter
5. `DriftMultiAssetCarryAdapter` - Multi-asset adapter
6. `DriftExecutionEventSubscriber` - Event subscriber

All related environment variables were also removed:
- `DRIFT_RPC_ENDPOINT`
- `DRIFT_PRIVATE_KEY`
- `DRIFT_READONLY_ENV`
- `DRIFT_READONLY_ACCOUNT_ADDRESS`
- `DRIFT_EXECUTION_ENV`
- All other `DRIFT_*` variables

---

## Alternative Approaches

For hackathon submission:

1. **Use backtesting** to demonstrate strategy performance
2. **Use simulation mode** to show framework functionality
3. **Document the architecture** and risk management approach
4. **Be transparent** about the Drift situation

---

## Future Development

Alternative venue adapters may be integrated post-hackathon:
- Mango Markets
- Jupiter Perpetuals
- Other Solana-based venues

These will require:
- Security audit
- Hackathon eligibility verification
- Proper testing and validation
