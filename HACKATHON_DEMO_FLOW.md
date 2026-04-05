# Sentinel Apex - Hackathon Demo Flow

**Complete step-by-step guide for hackathon submission video/demo**

---

## 🎬 Demo Video Structure (5-10 minutes)

### Part 1: Introduction & Login (30 seconds)

**What to show:**
1. Open https://www.sentinelapex.com
2. Show the honest deployment banner:
   - "Drift devnet only"
   - "BTC-PERP only" 
   - "No mainnet claim"
3. Login with:
   - Email: `gorkhmazb23@gmail.com`
   - Password: `Leon070124!!`

**What to say:**
> "Sentinel Apex is a delta-neutral carry vault protocol. We're demoing on devnet with truthful execution badges."

---

### Part 2: Dashboard Overview (1 minute)

**What to show:**
1. Main dashboard loads successfully
2. Point out the **Deployment Truth Banner**:
   - Environment: staging demo
   - Execution: devnet only
3. Show the sidebar navigation:
   - Portfolio
   - Carry
   - Treasury
   - Allocator
   - Venues
   - Submission

**What to say:**
> "The dashboard shows real-time protocol state with honest execution scope labels."

---

### Part 3: Submission Dossier (2 minutes)

**What to show:**
1. Navigate to **"Submission"** tab
2. Show:
   - Vault address field
   - Wallet address field
   - Execution evidence count
   - CEX verification status
   - Backtest evidence
3. Click **"Export Bundle"** or show the export button
4. Mention the artifact checklist:
   - On-chain trade activity
   - Realized performance
   - CEX verification
   - Multi-leg evidence

**What to say:**
> "The submission dossier tracks all evidence for hackathon judging. It shows completeness status and exportable judge bundle."

---

### Part 4: Carry Strategy (2 minutes)

**What to show:**
1. Navigate to **"Carry"** tab
2. Show:
   - Strategy recommendations
   - Opportunity detection
   - Carry actions list
   - Execution status
3. If available, show a completed carry action with:
   - Transaction signature
   - Execution details
   - Venue confirmation

**What to say:**
> "The carry module executes delta-neutral funding rate arbitrage. We track BTC-PERP on Drift devnet with full execution lifecycle."

---

### Part 5: CEX Verification (1 minute)

**What to show:**
1. Navigate to **"CEX Import"** or mention it
2. Show:
   - CSV upload capability
   - OKX API verification
   - PnL calculation
   - Trade history import

**What to say:**
> "CEX verification allows importing trade history from Binance, OKX, Bybit, Coinbase for cross-validation."

---

### Part 6: Backtesting (1 minute)

**What to show:**
1. Mention backtest capability
2. Show the backtest API endpoint or results if available:
   - Historical simulation
   - Performance metrics
   - Truthful caveats

**What to say:**
> "Backtesting provides historical simulation with truthful labeling - clearly marked as simulation, not live performance."

---

### Part 7: Architecture & Code (1 minute)

**What to show:**
1. Briefly show GitHub repo structure
2. Highlight:
   - 19 packages
   - TypeScript
   - Proper testing
   - Documentation

**What to say:**
> "The codebase is production-architected with proper separation of concerns, comprehensive documentation, and honest scope claims."

---

## 📋 Key Points to Mention

### Honesty Claims (IMPORTANT)
- ✅ "Devnet execution only"
- ✅ "BTC-PERP single market"
- ✅ "No mainnet deployment"
- ✅ "Historical simulation, not live performance"
- ✅ "Framework ready for production, demo scoped"

### Technical Highlights
- ✅ Multi-leg orchestration framework
- ✅ Risk engine with kill switch
- ✅ CEX verification pipeline
- ✅ Backtesting framework
- ✅ Submission dossier system
- ✅ Real Drift devnet execution

---

## 🎯 What Judges Should See

1. **Working login** ✅
2. **Dashboard loads** ✅
3. **Truthful execution badges** ✅
4. **Submission dossier functional** ✅
5. **Evidence export capability** ✅
6. **Clean codebase** ✅
7. **Honest limitations** ✅

---

## 📁 What to Submit

1. **Demo Video** (5-10 min) - Record the flow above
2. **GitHub Repo** - Already pushed
3. **Live URLs:**
   - Frontend: https://www.sentinelapex.com
   - API: https://sentinel-apex-api.onrender.com
4. **Export Bundle** - Generate from Submission tab

---

## 🚀 Quick Demo Commands

If you need to show API directly:

```bash
# Health check
curl https://sentinel-apex-api.onrender.com/health

# Submission dossier (with auth)
curl -H "X-API-Key: 0268977479db7442e6c56f8149e2a39c" \
  https://sentinel-apex-api.onrender.com/api/v1/submission
```

---

## ✅ Pre-Recording Checklist

- [ ] Dashboard loads without errors
- [ ] Login works
- [ ] Submission tab shows data
- [ ] No "Invalid API key" errors
- [ ] Truth badges visible
- [ ] GitHub repo is public
- [ ] Render services running

---

**Good luck with the submission! 🎉**
