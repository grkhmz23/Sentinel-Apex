# Demo Video Script

This demo uses deterministic, non-sensitive seed data. It does not use live
treasury values, signing, `sendTransaction`, Ika, or production privacy claims.

## Setup

```bash
pnpm demo:seed
pnpm dev
```

Open:

- `/pusd`
- `/encrypt`

The seed writes sanitized evidence to `.tmp/demo-evidence.json`. The file is
ignored by git and is safe to delete and recreate.

## 60-Second Version

1. “Sentinel Apex is showing the PUSD treasury vault in dry-run mode.”
2. Open `/pusd`.
3. “PUSD is the vault asset. This page shows read-only accounting evidence, not
   token movement.”
4. Point to the PUSD balance, NAV, accounting mode, and execution posture cards.
5. “The operator intent is a requested rebalance intent. It is not a live order.”
6. Open `/encrypt`.
7. “Encrypt is integrated as a pre-alpha SDK demo path using non-sensitive fixed
   demo inputs only.”
8. Point to SDK mode, endpoint host, program id, `productionPrivacyReady=false`,
   and `realEncryption=false`.
9. Point to ciphertext identifiers and strategy commitment.
10. “This proves a controlled SDK touchpoint and evidence trail. It does not
    prove production privacy.”

## 90-Second Version

1. “This is the Sentinel Apex PUSD plus Encrypt pre-alpha demo flow.”
2. “Before recording, I run `pnpm demo:seed`. That creates deterministic,
   non-sensitive evidence in `.tmp/demo-evidence.json` so the dashboard is
   repeatable without live network dependency.”
3. Open `/pusd`.
4. “The vault asset is PUSD. The balance and NAV cards are read-only accounting
   evidence. They are not treasury movement.”
5. “Execution posture is disabled. Signing and `sendTransaction` are disabled.
   The workflow is dry-run/operator-intent only.”
6. Point to the operator intent table.
7. “This is a requested PUSD rebalance intent for the demo. It is not a live
   execution request.”
8. Point to audit evidence.
9. “The audit trail records the seeded demo event and keeps the safety posture
   visible.”
10. Open `/encrypt`.
11. “Encrypt is shown as pre-alpha. The SDK mode is explicit, and the page labels
    `productionPrivacyReady=false` and `realEncryption=false`.”
12. Point to SDK demo result and evidence table.
13. “The SDK evidence includes ciphertext identifiers and a strategy commitment.
    The inputs are deterministic demo values only.”
14. Point to public/private split.
15. “The private-by-design fields are represented by pre-alpha refs for the demo,
    but this is still not production confidentiality.”
16. Close with: “The demo proves Sentinel Apex can present a safe PUSD treasury
    flow with an Encrypt pre-alpha integration touchpoint, while keeping live
    execution, signing, `sendTransaction`, Ika, and production privacy claims
    disabled.”

## Exact Talking Points

- “PUSD is first-class as the vault asset.”
- “Accounting is read-only in this demo.”
- “Operator intent is dry-run only.”
- “Live execution is disabled.”
- “Signing is disabled.”
- “`sendTransaction` is disabled.”
- “Encrypt is pre-alpha.”
- “The SDK demo uses non-sensitive deterministic inputs.”
- “`productionPrivacyReady=false`.”
- “`realEncryption=false`.”
- “Ciphertext refs and strategy commitment are evidence, not a production
  privacy guarantee.”

## What Not To Claim

- Do not claim production privacy.
- Do not claim real confidentiality.
- Do not claim live PUSD treasury execution.
- Do not claim signing or on-chain treasury movement.
- Do not claim `sendTransaction` is enabled.
- Do not claim Ika is implemented.
- Do not claim the pre-alpha devnet endpoint is reliable or persistent.
- Do not claim real treasury strategy values were submitted to Encrypt.
