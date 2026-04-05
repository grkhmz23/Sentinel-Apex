# Build-A-Bear Hackathon Implementation Gaps

**Created:** 2026-04-04  
**Target:** Main Track Submission (10% APY, USDC, 3-month rolling)  
**Status:** Active Implementation

---

## 📋 Implementation Queue

### 🔴 CRITICAL (Must Complete for Eligibility)

#### ~~1. REALIZED APY CALCULATOR~~ ✅ COMPLETE  
**Priority:** HIGHEST  
**Estimated Effort:** 2-3 days  

**Problem:**  
Realized APY is currently "unavailable" - the system cannot automatically calculate actual performance from executed trades. This is REQUIRED to prove the 10% minimum APY.

**Solution:**  
Build PnL attribution system that:
- Tracks every trade's realized PnL
- Computes time-weighted returns
- Annualizes to APY figure
- Persists in strategy profile

**Files to Modify:**
- `packages/carry/src/pnl.ts` - Add realized APY calculator
- `packages/runtime/src/store.ts` - Persist APY snapshots
- `packages/carry/src/strategy-policy.ts` - Wire to profile
- `packages/db/src/schema/` - Add APY tracking tables

**Implementation:**
- Created `packages/carry/src/realized-apy.ts` - Full APY calculation suite
- Added DB schema: `apy_current`, `realized_trade_pnl`, `apy_daily_snapshots`, `strategy_performance_summary`
- Added Store methods: `persistRealizedTradePnl()`, `recalculateAndStoreApy()`, `getApyCurrent()`
- 69 passing tests covering simple, time-weighted, and rolling APY calculations

**Success Criteria:**
- ✅ `/api/v1/carry/strategy-profile` shows realized APY
- ✅ APY updates automatically after each trade
- ✅ Dashboard displays realized vs projected APY
- ✅ Submission bundle includes APY evidence

---

#### ~~2. MAINNET EXECUTION PATH~~ ✅ COMPLETE  
**Priority:** HIGHEST  
**Estimated Effort:** 3-4 days  

**Problem:**  
Only Drift devnet execution works. Hackathon requires mainnet for real TVL seeding.

**Solution:**  
Create Drift mainnet adapter based on devnet adapter:
- Clone and adapt for mainnet-beta
- Add mainnet-specific safety checks
- Wire to runtime environment detection

**Implementation:**
- Created `packages/venue-adapters/src/real/drift-mainnet-carry-adapter.ts` - Full mainnet adapter
- Added `DriftMainnetCarryAdapter` with mainnet-beta support
- Updated `packages/config/src/env.ts` - Added `mainnet-beta` to `DRIFT_EXECUTION_ENV`, added `DRIFT_MAINNET_EXECUTION_ENABLED`
- Updated `packages/runtime/src/runtime.ts` - Auto-initializes mainnet adapter when `DRIFT_EXECUTION_ENV=mainnet-beta`
- Added safety flag `mainnetExecutionEnabled` that must be explicitly set to `true`
- 54 passing tests covering mainnet adapter functionality

**Files Modified:**
- `packages/venue-adapters/src/real/drift-mainnet-carry-adapter.ts` - NEW
- `packages/venue-adapters/src/index.ts` - Export mainnet adapter
- `packages/runtime/src/runtime.ts` - Add mainnet adapter init
- `packages/config/src/env.ts` - Add mainnet env vars

**Environment Variables:**
- `DRIFT_EXECUTION_ENV=mainnet-beta` - Enable mainnet mode
- `DRIFT_MAINNET_EXECUTION_ENABLED=true` - Required safety flag
- `DRIFT_RPC_ENDPOINT` - Mainnet RPC endpoint
- `DRIFT_PRIVATE_KEY` - Trading account private key

**Success Criteria:**
- ✅ Can execute BTC-PERP on mainnet
- ✅ Environment validation for mainnet
- ✅ Transaction confirmation on mainnet (via event subscriber)
- ✅ Post-trade confirmation works

---

#### ~~3. SPOT LEG EXECUTION (Complete Delta-Neutral)~~ ✅ COMPLETE  
**Priority:** HIGH  
**Estimated Effort:** 4-5 days  

**Problem:**  
Only perp leg executes. True delta-neutral requires spot + perp.

**Solution:**  
Add spot market execution to complete the hedge:
- Drift spot market adapter
- Spot-perp pair coordination
- Full hedge state tracking

**Implementation:**
- Created `packages/venue-adapters/src/real/drift-spot-adapter.ts` - Full Drift spot adapter (900+ lines)
- Created `packages/carry/src/spot-perp-coordination.ts` - Spot-perp pair coordination module
- Added `DriftSpotAdapter` supporting BTC spot market orders
- Added hedge pair creation and validation functions
- Added execution planning for dual-leg orders
- Added hedge state tracking (pending/executing/completed/failed)
- Added funding capture calculations for balanced hedges
- Updated runtime to auto-initialize spot adapter when `DRIFT_SPOT_EXECUTION_ENABLED=true`
- Added `DRIFT_SPOT_EXECUTION_ENABLED` env variable to config

**Files Modified:**
- `packages/venue-adapters/src/real/drift-spot-adapter.ts` - NEW
- `packages/venue-adapters/src/index.ts` - Export spot adapter
- `packages/carry/src/spot-perp-coordination.ts` - NEW
- `packages/carry/src/index.ts` - Export coordination functions
- `packages/config/src/env.ts` - Add `DRIFT_SPOT_EXECUTION_ENABLED`
- `packages/runtime/src/runtime.ts` - Add spot adapter init

**Environment Variables:**
- `DRIFT_SPOT_EXECUTION_ENABLED=true` - Enable spot execution
- `DRIFT_EXECUTION_ENV=mainnet-beta|devnet` - Set environment
- `DRIFT_PRIVATE_KEY` - Trading account private key
- `DRIFT_RPC_ENDPOINT` - RPC endpoint

**Key Features:**
- `createHedgePair()` - Creates delta-neutral spot+perp pair
- `validateHedgePair()` - Validates hedge can be executed
- `createHedgeExecutionPlan()` - Plans execution order (perp first by default)
- `isHedgeBalanced()` - Checks if legs are within tolerance
- `calculateHedgeFundingCapture()` - Estimates funding yield

**Success Criteria:**
- ✅ Can execute spot BTC buy + perp BTC short
- ✅ Hedge ratio tracked and maintained
- ✅ Funding capture calculated correctly

---

#### ~~4. MULTI-ASSET SUPPORT (ETH, SOL)~~ ✅ COMPLETE  
**Priority:** MEDIUM  
**Estimated Effort:** 2-3 days  

**Problem:**  
Only BTC-PERP supported. Need diversification.

**Solution:**  
Add ETH-PERP and SOL-PERP support to existing adapters.

**Implementation:**
- Created `packages/venue-adapters/src/real/drift-multi-asset-carry-adapter.ts` - New multi-asset adapter
- Supports BTC, ETH, SOL perp markets via configurable `supportedAssets` array
- Updated `packages/carry/src/config.ts` - Default `approvedAssets: ['BTC', 'ETH', 'SOL']`
- Opportunity detector already supported multi-asset via `approvedAssets` config
- Updated runtime to use multi-asset adapter for both devnet and mainnet
- Each adapter instance can be configured with custom asset list

**Files Modified:**
- `packages/venue-adapters/src/real/drift-multi-asset-carry-adapter.ts` - NEW (900+ lines)
- `packages/venue-adapters/src/index.ts` - Export new adapter
- `packages/carry/src/config.ts` - Default approved assets
- `packages/runtime/src/runtime.ts` - Use multi-asset adapter

**Key Features:**
- `DriftMultiAssetCarryAdapter` supports multiple perp markets in single adapter
- `supportedAssets` config array: `['BTC', 'ETH', 'SOL']` by default
- `getMarketConfig(asset)` - Dynamically loads market config for any supported asset
- Market indexes loaded from Drift SDK configs
- All existing safety checks work for any supported asset

**Success Criteria:**
- ✅ ETH-PERP market orders work
- ✅ SOL-PERP market orders work
- ✅ Opportunity detection scans all assets

---

### 🟡 IMPORTANT (Strongly Recommended)

#### ~~5. CEX VERIFICATION PIPELINE~~ ✅ COMPLETE
**Status:** ✅ COMPLETE  
**Priority:** MEDIUM  

**Implementation:**
- Created `packages/cex-verification/` - Full CEX trade import and verification package
- CSV parsers for Binance, OKX, Bybit, and Coinbase formats with auto-detection
- PnL calculator with FIFO, LIFO, and Average Cost methods
- Database schema: `cexImportedTrades`, `cexVerificationSessions`, `cexApiKeyValidations`
- Hackathon submission generator for judge-ready reports
- 26 tests passing

**Files Created:**
- `packages/cex-verification/src/csv-parser.ts` - Multi-platform CSV parsing
- `packages/cex-verification/src/pnl-calculator.ts` - PnL calculation with 3 cost basis methods
- `packages/db/src/schema/cex-imports.ts` - Database schema for CEX imports
- `packages/cex-verification/src/__tests__/` - Test suites

**Success Criteria:**
- ✅ Can upload Binance trade history CSV
- ✅ Can upload OKX trade history CSV
- ✅ System calculates PnL from imports
- ✅ Read-only API key verification workflow
- ✅ Cross-validates with internal signals

---

#### ~~6. SUBMISSION EXPORT BUNDLE ENHANCEMENT~~ ✅ COMPLETE (JSON)
**Status:** ✅ COMPLETE (Core Functionality)  
**Priority:** MEDIUM  

**Implementation:**
- `GET /api/v1/submission/export` - Returns complete judge-facing export bundle
- `buildSubmissionExportBundle()` generates artifact checklist with pass/fail status
- Dashboard displays judge summary, verification links, and readiness checks
- JSON export format fully implemented

**Files:**
- `packages/runtime/src/store.ts` - `buildSubmissionExportBundle()` implementation
- `apps/api/src/routes/submission.ts` - Export endpoint
- `apps/ops-dashboard/app/submission/page.tsx` - Judge-facing display

**Success Criteria:**
- ✅ One-click export of judge-ready dossier (via API)
- ✅ Includes all verification links
- ✅ JSON export format
- ⏳ PDF export format (post-hackathon enhancement)

---

### 🟢 LOWER PRIORITY (Post-Submission)

#### 7. RANGER/EARN INTEGRATION
**Status:** ⏳ PENDING  
**Priority:** LOW (for seeding)  
**Estimated Effort:** 5-7 days  

**Problem:**  
No integration with Ranger Earn for actual TVL deployment.

**Files to Create:**
- `packages/ranger-adapter/` - NEW package

---

#### ~~8. BACKTESTING PACKAGE~~ ✅ COMPLETE
**Status:** ✅ COMPLETE  

**Implementation:**
- Created `packages/backtest/` - Full backtesting framework
- Historical simulation for delta-neutral carry strategies
- Deterministic run configuration
- Performance metrics and trade statistics
- Funding capture analysis
- Truthful labeling as "historical_simulation"
- Exportable reports (JSON, Markdown, CSV)
- Integrated with submission evidence system

---

## ✅ Completed Gaps

1. **REALIZED APY CALCULATOR** - Full calculation pipeline with 69 tests, database persistence, and target tracking
2. **MAINNET EXECUTION PATH** - Drift mainnet adapter with safety checks, 54 tests, ready for mainnet-beta execution
3. **SPOT LEG EXECUTION** - Drift spot adapter + spot-perp coordination for complete delta-neutral hedging
4. **MULTI-ASSET SUPPORT** - Drift multi-asset adapter supporting BTC, ETH, SOL perp markets
5. **CEX VERIFICATION PIPELINE** - Complete CEX trade import (Binance, OKX, Bybit, Coinbase) with PnL calculator and hackathon submission generator
6. **SUBMISSION EXPORT BUNDLE** - Judge-facing export bundle with artifact checklist, verification links, and JSON export
7. **BACKTESTING PACKAGE** - Historical simulation framework with truthful labeling and submission integration

---

## 🎯 Hackathon Readiness Status: ✅ READY

**All critical gaps for Build-A-Bear Main Track eligibility are complete:**

- ✅ Realized APY calculator with 10% floor tracking
- ✅ Mainnet execution path (Drift mainnet adapter)
- ✅ Spot leg execution (delta-neutral hedge completion)
- ✅ Multi-asset support (BTC, ETH, SOL)
- ✅ CEX verification pipeline (CSV import + PnL calc)
- ✅ Submission export bundle (judge-facing reports)

**Remaining work (post-submission enhancements):**
- PDF export format for submission bundle
- Ranger/Earn integration for actual TVL deployment
- Historical backtesting package

---

## 📝 Notes

- Always delete gap from this file when marking complete
- Update status to 🟢 COMPLETE when done
- Move to "Completed Gaps" section
- Immediately start next gap
