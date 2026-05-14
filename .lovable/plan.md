## Problem

Two related bugs:

1. **"Wallet not provisioned"** when scanning on a fresh device. The `_authenticated.tsx` layout provisions the wallet inside a `useEffect` that fires async — if a user lands directly on `/scan` and scans immediately, `claimPop` runs before `profiles.wallet_address` has been written, so the server returns `no_wallet`.
2. **"Receive TXC" card renders blank** for the same reason — the QR only renders once `address` state is set, and on a fresh device that write hasn't happened yet.

The flow also buries POP (the actual product) under a giant TXC receive QR, which is the wrong hierarchy.

## Approach

Per your answers: **auto-create per-device** with a clear warning, and a **soft nudge** to back up the phrase (no hard gate).

### 1. Make wallet provisioning deterministic (fix the race)

- Move provisioning into a small client hook `useEnsureWallet()` that returns `{ address, ready }`.
- Both `/app` and `/scan` call it. The scan button stays disabled (with a "Setting up wallet…" spinner) until `ready === true`. No more timing-dependent `no_wallet` errors.
- On second device: detect that `profiles.wallet_address` already exists but differs from the locally-derived one. Show a one-time toast: *"This device created a new wallet. POP minted before today went to your other device's wallet."* Then overwrite (per your choice).

### 2. Redesign `/app` hierarchy

New top-to-bottom order:

```text
┌─────────────────────────────┐
│  POP balance (huge, hero)   │  ← main feature
│  1,234 POP                  │
│  3 events attended          │
│  [ Scan to Earn ]           │
├─────────────────────────────┤
│  Recent activity            │
├─────────────────────────────┤
│  Backup banner (dismissible)│  ← soft nudge, persistent until backed up
│  "Save your recovery phrase"│
│  [ Reveal ] [ Download .txt]│
├─────────────────────────────┤
│  TXC wallet (compact)       │  ← collapsed by default
│  T9aB…x4Kq · 0.00 TXC       │
│  [ Show QR ▾ ]              │
└─────────────────────────────┘
```

- POP balance card stays as the visual anchor (already good).
- The full-size TXC QR collapses into a single row showing truncated address + tiny TXC balance. Tapping expands to reveal the QR + copy button.
- Backup banner persists (stored in `localStorage: cryptopop:backed-up`) until the user clicks "Download .txt" or explicitly dismisses with "I've saved it".
- Recovery-phrase download writes a plain `.txt` with the 12 words + a one-line warning.

### 3. Better scan-page error for the edge case

If `claimPop` ever still returns `no_wallet` (e.g. localStorage cleared mid-session), the toast becomes actionable: *"Wallet setup interrupted. Tap to retry."* — tapping re-runs `useEnsureWallet()` and re-submits.

### 4. TXC balance (small)

For the compact TXC row, fetch balance lazily via the existing `txc.server.ts` mempool helper (new tiny serverFn `getTxcBalance(address)`). If the call fails, show `—` instead of breaking the card. Cached for 30s.

## Files touched

- `src/hooks/use-ensure-wallet.ts` *(new)* — shared provisioning hook.
- `src/lib/wallet.functions.ts` *(new)* — `getTxcBalance` serverFn.
- `src/routes/_authenticated.tsx` — remove the inline `useEffect`, just render `<Outlet />`.
- `src/routes/_authenticated.app.tsx` — re-layout per wireframe above; consume the hook; collapse TXC; add backup banner state.
- `src/routes/_authenticated.scan.tsx` — gate the Scanner on `ready`; better `no_wallet` retry copy.

## Out of scope

- Importing an existing recovery phrase on a new device (you chose per-device wallets).
- Hard setup gate / forced backup (you chose soft nudge).
- Any DB/RLS changes — schema is unchanged.
