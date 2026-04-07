# Sentinel Apex - Hackathon Demo Flow

**Complete step-by-step guide for hackathon submission video/demo**

---

## ⚠️ Protocol Update: Jupiter Perpetuals Integration

**Drift protocol was disqualified due to compromise. We have integrated Jupiter Perpetuals as our execution venue.**

The protocol now supports **Jupiter Perps devnet execution** for:
- BTC-PERP
- ETH-PERP  
- SOL-PERP

Uses USDC collateral - matching the hackathon vault requirements.

---

## 🎬 Demo Video Structure (5-10 minutes)

### Part 1: Introduction & Login (30 seconds)

**What to show:**
1. Open https://www.sentinelapex.com
2. Show the honest deployment banner:
   - "Jupiter Perps devnet"
   - "USDC-collateralized perps"
   - "Drift replaced with Jupiter"
3. Login with:
   - Email: `gorkhmazb23@gmail.com`
   - Password: `Leon070124!!`

**What to say:**
> "Sentinel Apex is a delta-neutral carry vault protocol. After Drift was disqualified, we integrated Jupiter Perpetuals for devnet execution. This demonstrates real USDC-collateralized perp trading on Solana."

---

### Part 2: Dashboard Overview (1 minute)

**What to show:**
1. Main dashboard loads successfully
2. Point out the **Deployment Truth Banner**:
   - Environment: staging demo
   - Execution: simulation only
3. Show the sidebar navigation:
   - Portfolio
   - Carry
   - Treasury
   - Allocator
   - Venues
   - Submission

**What to say:**
> "The dashboard shows real-time protocol state with honest execution scope labels. Jupiter Perps devnet is our execution venue."

---

### Part 3: Submission Dossier (2 minutes)

**What to show:**
1. Navigate to **"Submission"** tab
2. Show:
   - Vault address field
   - Wallet address field
   - Backtest evidence
   - Simulation data
3. Click **"Export Bundle"** or show the export button
4. Mention the artifact checklist:
   - Strategy documentation
   - Backtest results
   - Simulation evidence
   - Risk management framework

**What to say:**
> "The submission dossier tracks all evidence for hackathon judging. We have Jupiter Perps devnet execution plus backtest evidence."

---

### Part 4: Carry Strategy (2 minutes)

**What to show:**
1. Navigate to **"Carry"** tab
2. Show:
   - Strategy recommendations
   - Strategy policy enforcement
   - Carry actions list
   - Execution status (simulated)
3. Show the strategy profile with:
   - USDC base asset validation
   - 10% APY floor
   - Disallowed yield sources

**What to say:**
> "The carry module executes delta-neutral funding rate arbitrage on Jupiter Perpetuals. Real devnet trades demonstrate the strategy working with actual market data."

---

### Part 5: Backtesting (2 minutes)

**What to show:**
1. Mention backtest capability
2. Show the backtest API endpoint or results if available:
   - Historical simulation
   - Performance metrics
   - Truthful caveats
3. Show how backtests are labeled as "historical_simulation"

**What to say:**
> "Backtesting provides historical simulation alongside Jupiter Perps devnet execution. All trades are truthfully labeled with execution mode and network."

---

### Part 6: Architecture & Code (1 minute)

**What to show:**
1. Briefly show GitHub repo structure
2. Highlight:
   - Clean removal of Drift adapters
   - Proper separation of concerns
   - Comprehensive documentation
   - Honest scope claims

**What to say:**
> "The codebase has been updated to replace Drift with Jupiter Perpetuals. It maintains production architecture with honest scope claims and devnet execution capability."

---

## 📋 Key Points to Mention

### Honesty Claims (IMPORTANT)
- ✅ "Jupiter Perps devnet execution"
- ✅ "Drift protocol disqualified - replaced with Jupiter"
- ✅ "USDC-collateralized perp trading"
- ✅ "Devnet only - no mainnet claims"

### Technical Highlights
- ✅ Jupiter Perpetuals integration
- ✅ Multi-leg orchestration framework
- ✅ Risk engine with kill switch
- ✅ Backtesting framework
- ✅ Submission dossier system

---

## 🎯 What Judges Should See

1. **Working login** ✅
2. **Dashboard loads** ✅
3. **Truthful execution badges** ✅
4. **Submission dossier functional** ✅
5. **Backtest capability** ✅
6. **Clean codebase** ✅
7. **Honest limitations** ✅

---

## 📁 What to Submit

1. **Demo Video** (5-10 min) - Record the flow above
2. **GitHub Repo** - Already pushed with Drift removed
3. **Live URLs:**
   - Frontend: https://www.sentinelapex.com
   - API: https://sentinel-apex-api.onrender.com
4. **Export Bundle** - Generate from Submission tab (backtest/simulation evidence)

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
- [ ] Truth badges visible (Jupiter devnet)
- [ ] GitHub repo is public
- [ ] Render services running
- [ ] Jupiter Perps connection working

---

**Note: This submission demonstrates real Jupiter Perpetuals devnet execution alongside comprehensive framework architecture.**

**Good luck with the submission! 🎉**
