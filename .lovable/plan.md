## Goal

Wire real TXC L2 token minting into the claim flow so when a user scans a QR, the server actually mints POP tokens to their wallet (not just credits the DB mirror).

## How minting works

The texitcoin.org minter UI is a thin frontend that takes:
- `tokenId` (ours = 19)
- `amount` (number of tokens)
- `privateKey` (WIF of the token creator — already stored as `MINTER_WIF`)
- `receiverAddress` (destination TXC address)

Under the hood this is a TXC L2 op: the creator's WIF signs a transaction that increases supply of token #19 and outputs the new tokens to `receiverAddress`. The same operation is callable directly via the TXC RPC daemon you already have configured (`TXC_RPC_URL`, `TXC_RPC_USER`, `TXC_RPC_PASS`).

I couldn't pull a public REST spec from `tokens.texitcoin.org` (the page is a static SPA, the underlying API isn't documented at a stable path I can hit). So we have two viable paths and I want you to pick before I build.

## Two paths

**Path A — Call the TXC RPC directly (preferred)**
Build a server function `mintPop({ amount, toAddress })` that POSTs a JSON-RPC `minttoken` (or equivalent — exact method name confirmed against your node) to `TXC_RPC_URL` with basic auth, signed by `MINTER_WIF` and parameterized with token id `19`. No third-party service in the loop. Fastest, most reliable, and matches the secrets you already provisioned.

Risk: I need to confirm the exact RPC method name on your node. I'll ask you to run one `getrpcinfo` / `help` call (or paste the method list) so I wire the right call. Five-minute confirmation.

**Path B — Reverse-engineer the tokens.texitcoin.org API**
Open the minter site in a browser, submit a tiny test mint, capture the network request, then call the same endpoint from our server function. Works without touching your RPC node, but adds a third-party dependency and a moving target if they change the API.

## Where this plugs into the app

1. New file `src/lib/txc.functions.ts` exporting:
   - `mintPop({ amount, toAddress })` — admin-only or internal, returns `{ tx_hash }` or `{ error }`
2. `claimPop` in `src/lib/qr.functions.ts` becomes a two-stage flow:
   - **Stage 1 (sync, already built):** verify QR + geofence + uniqueness, insert `claims` row with `status='pending'`, bump `pop_balance_mirror`, return success to the user.
   - **Stage 2 (async, new):** immediately after Stage 1 returns, fire `mintPop({ amount: total, toAddress: profile.wallet_address })`. On success, update the `claims` row with `tx_hash` and `status='minted'`. On failure, set `status='failed'` and store the error — DB credit stays so the user keeps their POP, and we can retry from an admin tool later.
3. Wallet view shows `tx_hash` (linked to a TXC explorer) on each recent claim once it settles.

## Wallet-address caveat

Right now `wallet.ts` derives a placeholder pseudo-address ("T" + base58 of seed bytes) — that is **not** a valid TXC P2PKH address and any real mint sent to it will be unspendable. Before we turn on real minting we need to swap `deriveTxcAddress` to a real derivation: `bitcoinjs-lib` with TXC network params (P2PKH version byte) seeded from the BIP39 mnemonic.

I'll do this in the same pass — it's the precondition for minting to mean anything.

## What does NOT change in this pass
- Quiz / referral rewards
- QR signing, geofence, uniqueness checks
- Admin event creator UI

## Order of operations

1. You confirm Path A vs Path B (and, if A, paste your node's `help` output or the mint RPC name)
2. Replace `deriveTxcAddress` with real `bitcoinjs-lib`-based TXC P2PKH derivation
3. One-time migration: re-derive the current logged-in user's `wallet_address` to a valid TXC address (your existing placeholder address gets overwritten next time you load `/app`)
4. Build `mintPop` server function
5. Wire stage-2 mint into `claimPop`; persist `tx_hash` + `status`
6. Surface tx hash + explorer link in the wallet recent-claims list
7. Test: scan QR → see instant +N POP → tx hash appears within ~30s

## Questions before I build

1. **Path A or Path B?**
2. **TXC P2PKH version byte** — do you know it offhand? (Standard guess: `0x41` → "T" prefix, but I want to confirm against your network.) If not, I'll grab it from `getblockchaininfo` / network params.
3. **Explorer URL pattern** for tx links (e.g. `https://explorer.texitcoin.org/tx/{hash}`)?