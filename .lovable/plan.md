# Phase 3 — Guided POP Token Minting

Goal: every org can mint its own POP token on TXC L2 (Omni managed property) through a 4-step wizard. CryptoPOP USA stays on property #37 / current WIF — nothing breaks for it.

## Strategy: de-risk first

Build the on-chain plumbing as standalone server functions and prove it against a **second** test token issued from a fresh wallet under the CryptoPOP USA org row before exposing the wizard to new admins. CryptoPOP USA keeps property #37 either way.

## Slice A — Refactor TXC pipeline to be org-aware (no UI)

1. `src/lib/txc.server.ts` — `mintGrant({ to, amount, memo, propertyId, minterWif })`. Drop env fallbacks at the call site; keep them only inside a `resolveMinterFromEnv()` helper used for one-off scripts.
2. New `src/lib/org-minter.server.ts` — `getOrgMinter(orgId)` returns `{ propertyId, minterWif, address }`. Looks up `organizations.txc_property_id` + joins `organization_wallet_secrets`, decrypts WIF with `wallet-crypto.server`. Throws `OrgNotMintedError` if `txc_property_id` is null.
3. Thread `orgId` through every mint call site:
   - `pop-awards-admin.functions.ts` (admin manual award) — derive from event's `org_id`
   - `pop-reconcile.functions.ts` — derive per pending row
   - `qr.functions.ts` (claim) — derive from qr_code's event's `org_id`
   - `email-wallet.server.ts` — derive from award row's `org_id`
4. Backfill check: CryptoPOP USA org row already has property 37 + minter_wallet_address. We need to **insert** its existing TXC_WIF (encrypted) into `organization_wallet_secrets` so prod keeps working. One-time migration.

## Slice B — Wallet generation + storage

5. `wallet-crypto.server.ts` already encrypts; add `encryptOrgMinterWif(orgId, wif)` / `decryptOrgMinterWif(orgId, ciphertext)` keyed by `WALLET_ENCRYPTION_KEY + orgId`.
6. Server fn `createOrgMinterWallet({ orgId })` — owners only:
   - generate fresh ECPair on TXC network
   - derive P2PKH address
   - encrypt WIF
   - upsert into `organization_wallet_secrets`, set `organizations.minter_wallet_address`
   - idempotent: if address already set and secret already exists, return existing

## Slice C — Funding poller

7. Server fn `getMinterFundingStatus({ orgId })` — returns `{ address, balanceSats, requiredSats, confirmations, ready }`. Polls mempool.texitcoin.org `/address/<addr>` for confirmed balance. Required = enough TXC for issuance (~3k sats) + ~100 mints buffer.
8. UI polls every 6s while wizard is open on this step.

## Slice D — Issue Omni managed property

9. Server fn `issueOrgPopToken({ orgId, tokenName, tokenSymbol })` — owners only:
   - guard: already has `txc_property_id` → return existing
   - guard: funding status `ready` true
   - RPC `omni_sendissuancemanaged` from minter wif (we sign locally same as mintGrant), broadcast via mempool /tx
   - poll `omni_listproperties` until new property visible, store `txc_property_id` on org
   - store `pop_token_name`, `pop_token_symbol` on org
10. Wizard step shows broadcast txid + link to mempool.texitcoin.org and live "waiting for confirmation".

## Slice E — Wizard UI

11. New route `_authenticated.admin.mint-token.tsx` — 4 steps:
    1. **Name your token** — name (e.g. "Lakehouse POP"), symbol (e.g. "LAKE", 3–5 chars, uppercase). Validate uniqueness on submit only at wizard-finish.
    2. **Review** — show on-chain fee estimate, "this is permanent", confirm.
    3. **Fund the minter** — show address + QR + live balance + amount needed. "Send X TXC to this address." Auto-advances when ready.
    4. **Issue** — one button → calls `issueOrgPopToken`, shows txid, polls until property id assigned. Done → redirect to `/admin`.
12. Dashboard lock: `_authenticated.admin.index.tsx` checks org's `txc_property_id`. If null → big card "Mint your POP token" → wizard. Existing tiles disabled with explanatory copy. CryptoPOP USA unaffected (property already set).

## Slice F — De-risk run (manual, you + me)

13. Create a second test org "TXC Test Org" (owner = you).
14. Run the wizard end-to-end against it on prod. Verify: wallet creation → fund with ~5000 sats → issuance broadcasts → property id stored → mint a grant to a test address → balance shows on chain.
15. Only after that, expose the "Create your community" public flow (Phase 2).

## Technical notes (engineer-facing)

- `omni_sendissuancemanaged` RPC returns a complete signed hex if the node holds the WIF; we don't want the node to hold WIFs. Instead use `omni_createpayload_issuancemanaged` + same UTXO/sign/broadcast path as `mintGrant`. Reuse helpers from `txc.server.ts` (factor `buildOmniTx({ payloadHex, toAddress, wif })` so both grant and issuance share it).
- WIF encryption: AES-GCM with key = HKDF(WALLET_ENCRYPTION_KEY, salt=orgId). Same pattern as existing `wallet-crypto.server`.
- Funding requirement: 1 issuance tx (~250 vbytes × 5 sat/vb = 1250 sats) + 100 mints × ~1500 sats = ~150k sats buffer. Show as TXC (8 decimals).
- Property naming on chain: name, category="POP", subcategory="Community", url=org's public page, data="" — managed, indivisible.
- All wizard mutations gated by `has_org_role(uid, orgId, ARRAY['owner']::org_role[])`.

## Out of scope for Phase 3

- Platform-sponsored funding pool (open question #1 from the original plan). Wizard says "send X TXC yourself" for now; we add sponsorship in Phase 5.
- Bring-your-own-wallet rotation.
- Mint-time fee billing.

## Open question

The original plan listed funding the first 100 mints as an open question. **I'm proposing org-pays-itself for the de-risk pass** — simplest, no platform float to manage, you control the test. We can add platform sponsorship later. OK?
