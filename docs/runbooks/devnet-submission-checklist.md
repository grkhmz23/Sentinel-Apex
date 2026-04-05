# Devnet Submission Checklist

**Purpose:** Pre-submission verification for Build-A-Bear hackathon devnet demo

**Date:** _______________  
**Operator:** _______________  
**Version Tagged:** _______________

---

## Repository State

- [ ] Clean working directory (`git status` shows no uncommitted changes)
- [ ] All changes committed with descriptive messages
- [ ] Version tagged (`git tag -a v{version} -m "Hackathon submission"`)
- [ ] Push tags to origin (`git push origin --tags`)

## Build & Validation

- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` - all 19 packages build successfully
- [ ] `pnpm typecheck` - no type errors
- [ ] `pnpm lint` - no lint errors
- [ ] `pnpm test` - tests pass (where test infrastructure works)
- [ ] `pnpm validate` - full validation passes

## Documentation

- [ ] README.md accurately reflects current capabilities
- [ ] GAPS.md updated with completed items
- [ ] No contradictory claims between docs
- [ ] Architecture docs match implementation
- [ ] API documentation current (if applicable)

## Devnet Demo Readiness

- [ ] Demo runbook reviewed and tested
- [ ] Environment variables documented
- [ ] Prerequisites checklist complete
- [ ] Demo scenario defined end-to-end
- [ ] Rollback/failure guidance documented

## Submission Evidence

- [ ] Submission dossier can be generated
- [ ] Export bundle creates valid JSON
- [ ] Evidence types supported:
  - [ ] On-chain transactions
  - [ ] Performance snapshots
  - [ ] CEX verification (if applicable)
  - [ ] Backtest simulations
- [ ] Judge summary is accurate

## Feature Verification

### Build-A-Bear Requirements
- [ ] USDC-denominated strategy
- [ ] 10% APY floor tracking
- [ ] 3-month rolling tenor
- [ ] Disallowed yield sources blocked

### Execution
- [ ] Drift devnet execution works
- [ ] Transaction confirmation flow
- [ ] Post-trade reconciliation
- [ ] Execution evidence capture

### Submission System
- [ ] Dossier persistence
- [ ] Evidence attachment
- [ ] Export bundle generation
- [ ] Completeness tracking

## Security & Safety

- [ ] No hardcoded secrets in repo
- [ ] `.env.example` has all required variables
- [ ] No private keys in code
- [ ] API secrets configurable
- [ ] Execution mode properly gated

## Truthfulness Verification

- [ ] No claims of mainnet execution
- [ ] No claims of full delta-neutral (if not implemented)
- [ ] Backtests labeled as simulations
- [ ] Devnet status clearly stated
- [ ] All blockers documented honestly

## Known Blockers Documented

- [ ] Mainnet execution: Documented as future work
- [ ] Spot leg execution: Documented status
- [ ] Multi-asset support: Documented status
- [ ] Ranger integration: Documented as external dependency
- [ ] Production hardening: Documented as incomplete

## Final Review

- [ ] Read through README with "judge eyes"
- [ ] Verify all links work
- [ ] Check for typos in docs
- [ ] Verify build instructions work on clean machine
- [ ] Test demo flow one more time

## Submission Package

- [ ] Repo URL: _____________________________
- [ ] Demo video: _____________________________ (if required)
- [ ] Submission form: _____________________________
- [ ] Additional artifacts: _____________________________

## Sign-off

**Developer:** _______________ Date: _______________

**Reviewer:** _______________ Date: _______________

---

## Notes

Any additional notes or blockers:


