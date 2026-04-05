# Phase R3 Part 6 - CEX Verification Gap Analysis

## Audit Date
2026-04-05

## 1. Current CEX Verification State

### What Already Exists

#### Database Schema (`packages/db/src/schema/cex-imports.ts`)
- ✅ `cexTradeImports` - Main import tracking table
- ✅ `cexImportedTrades` - Individual trade records
- ✅ `cexApiCredentials` - API key storage (with encryption placeholder)
- ✅ `cexCrossValidations` - Cross-validation results
- ✅ `cexPnlSnapshots` - PnL calculation snapshots
- ✅ Support for platforms: Binance, OKX, Bybit, Coinbase
- ✅ Support for import types: CSV, API
- ✅ API key status tracking: unverified, verifying, verified, invalid, expired

#### API Routes (`apps/api/src/routes/cex-verification.ts`)
- ✅ `GET /api/v1/cex-verification/sessions` - List sessions
- ✅ `GET /api/v1/cex-verification/sessions/:sessionId` - Get session detail
- ✅ `POST /api/v1/cex-verification/sessions` - Create session (CSV upload)
- ✅ `POST /api/v1/cex-verification/validate-csv` - Validate CSV format
- ✅ `POST /api/v1/cex-verification/sessions/:sessionId/calculate-pnl` - Calculate PnL
- ✅ `GET /api/v1/cex-verification/sessions/:sessionId/submission-report` - Generate report
- ✅ `PATCH /api/v1/cex-verification/sessions/:sessionId` - Update status
- ✅ `DELETE /api/v1/cex-verification/sessions/:sessionId` - Delete session

#### CEX Verification Package (`packages/cex-verification`)
- ✅ CSV parser with platform detection (Binance, OKX, Bybit, Coinbase)
- ✅ PnL calculator (FIFO, LIFO, average)
- ✅ Trade normalization
- ✅ Hackathon submission report generation

#### Submission Dossier Integration
- ✅ CEX fields in dossier: `cexExecutionUsed`, `cexVenues`, `cexTradeHistoryProvided`, `cexReadOnlyApiKeyProvided`
- ✅ CEX evidence types: `cex_trade_history`, `cex_read_only_api`
- ✅ Submission readiness checks for CEX artifacts
- ✅ Export bundle includes CEX artifact checklist

### What's Missing / Stubbed

#### Critical Gap: Store Implementation
The store methods are **stub implementations** that don't persist to the database:

```typescript
// store.ts line 12839
// This is a stub implementation - the actual DB schema was created in packages/db/src/schema/cex-imports.ts
// Full implementation would query the cexVerificationSessions table
return [];
```

Methods that need full implementation:
- `listCexVerificationSessions()` - Returns empty array
- `getCexVerificationSession()` - Returns null
- `createCexVerificationSession()` - Parses CSV but doesn't persist to DB
- All other CEX methods are stubs

#### Critical Gap: Read-Only API Integration
**No actual exchange API integration exists.**

The `cexApiCredentials` table exists but:
- No API client implementations for any exchange
- No credential validation logic
- No trade fetching from exchange APIs
- No rate limiting or error handling

#### Schema Not Connected
The store doesn't import or use:
- `cexTradeImports`
- `cexImportedTrades`
- `cexApiCredentials`
- Any CEX-related tables from `@sentinel-apex/db`

## 2. What's Feasible in This Pass

### Realistically Implementable

1. **OKX API Integration** (Recommended primary)
   - Strong API documentation
   - Read-only API keys supported
   - Trade history endpoint available
   - Rate limits reasonable

2. **Binance API Integration** (Secondary)
   - Most widely used
   - Read-only API available
   - More complex rate limiting

3. **Store Implementation**
   - Connect existing schema to store methods
   - Persist CSV imports to database
   - Query and retrieve trade data

4. **Credential Handling**
   - Environment-based credential storage
   - Validation endpoints
   - Explicit security documentation

### Partial / Documentation Only

- **Bybit API** - Can add structure but full implementation may be partial
- **Coinbase API** - Complex OAuth flow, may need documentation-only approach

### Not Feasible

- Full encryption at rest for credentials (would require KMS/vault integration)
- Real-time trade streaming (out of scope)
- Multi-account portfolio aggregation (complexity too high)

## 3. Current Security/Credential Storage Gaps

### Current State
- Schema has `apiKey`, `apiSecret` fields (marked as "should be encrypted")
- No actual encryption implementation
- No secure credential storage mechanism
- No credential rotation logic

### Required Approach
Given repo constraints, implement:
1. **Environment-based credentials** for read-only API access
2. **Explicit documentation** about security boundaries
3. **Validation-only storage** - don't persist API secrets to DB
4. **Read-only key enforcement** - verify keys don't have trading permissions

## 4. Implementation Plan (Priority Order)

### Step 1: Store Implementation (Foundation)
Connect existing CEX schema to store methods:
- Import CEX tables from `@sentinel-apex/db`
- Implement `listCexVerificationSessions()` with actual DB queries
- Implement `getCexVerificationSession()` with trade retrieval
- Implement `createCexVerificationSession()` with persistence
- Implement `validateCexCsv()` fully

### Step 2: OKX API Integration (Primary Exchange)
Implement OKX read-only API:
- OKX API client with rate limiting
- Credential validation endpoint
- Trade history fetching
- Error handling for common cases

### Step 3: Normalized Trade Model
Ensure consistency between CSV and API imports:
- Unified trade schema
- Provenance tracking (source: csv|api)
- Verification freshness timestamps
- Unsupported field markers

### Step 4: Credential Handling
Safe credential management:
- Environment configuration schema
- Credential validation without persistent storage
- Read-only permission verification
- Security documentation

### Step 5: Submission Dossier Integration
Link CEX verification to Phase R3 Part 5:
- Completeness reflects CEX API verification state
- Reports include verified exchange evidence
- Dossier distinguishes API vs CSV vs missing

### Step 6: API & Dashboard
New endpoints and UI:
- API validation endpoints
- Dashboard verification status panel
- Exchange connection workflow

### Step 7: Documentation
Truthful documentation:
- Architecture doc
- Runbooks for setup
- Security boundaries
- Completion report

## 5. Required Changes Summary

### Schema Updates
- ✅ Existing (may need minor tweaks)

### Store Changes
- Import CEX tables from `@sentinel-apex/db`
- Implement all stub CEX methods
- Add OKX API client

### Control Plane Changes
- Add OKX credential validation
- Add trade fetching methods

### API Routes Changes
- Add `/api/v1/verification/cex/:exchangeId/validate`
- Add `/api/v1/verification/cex/:exchangeId/fetch`
- Update existing routes if needed

### Dashboard Changes
- CEX verification status page
- Exchange API connection UI
- Credential validation display

### Documentation
- Architecture doc
- Runbooks
- Security guidelines
- Completion report

## 6. Blockers and Risks

### Technical Blockers
1. **No existing API client patterns** in repo for exchanges
2. **No credential encryption** - must document this limitation
3. **Stub implementations** - need full store reimplementation

### Mitigation
- Document security limitations clearly
- Use environment variables for credentials
- Implement OKX fully as proof of concept
- Leave others documented but partial

## 7. Success Criteria

- [ ] Store methods use actual DB tables (not stubs)
- [ ] OKX read-only API integration working
- [ ] CSV import still functional
- [ ] Credential validation endpoint
- [ ] Submission dossier reflects CEX verification state
- [ ] Reports distinguish API vs CSV evidence
- [ ] Documentation truthful about limitations

---

## Next Steps

1. Create implementation branch
2. Connect CEX schema to store
3. Implement OKX API client
4. Add credential handling
5. Integrate with submission dossier
6. Add dashboard UI
7. Write documentation
8. Run validation
