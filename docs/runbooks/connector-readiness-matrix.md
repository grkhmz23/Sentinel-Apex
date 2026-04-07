# Connector Readiness Matrix

**Last Updated:** Post-Drift Removal

**Status:** All Drift connectors removed due to hackathon disqualification.

---

## ⚠️ Important Notice

Drift protocol has been compromised and is **disqualified from hackathon prize eligibility**. All Drift-related connectors have been removed from the codebase.

---

## Available Connectors

### Simulation-Only

| Connector | Type | Status | Notes |
|-----------|------|--------|-------|
| `simulated` | Carry/Treasury | ✅ Available | Default for all execution |

### Real Execution

| Connector | Type | Status | Notes |
|-----------|------|--------|-------|
| None | - | 🔴 Blocked | Pending alternative venue integration |

---

## Historical Reference (Removed)

The following connectors were removed:

- `drift-solana-readonly` - Read-only Drift truth adapter
- `drift-solana-devnet-carry` - Devnet carry execution adapter
- `drift-solana-mainnet-carry` - Mainnet carry execution adapter (was never enabled)
- `drift-spot` - Drift spot market adapter
- `drift-multi-asset` - Multi-asset Drift adapter

---

## Future Integrations

Potential alternative venues for future integration:

- Mango Markets
- Jupiter Perpetuals
- Other Solana DEXs with perpetual markets

**Note:** Any new venue integration must comply with hackathon eligibility requirements and undergo security review.

---

## Submission Guidance

For the hackathon submission:

1. **Use simulation mode** for all demonstrations
2. **Highlight backtesting results** as primary evidence
3. **Document the framework** architecture and risk management
4. **Be transparent** about the Drift removal and why
