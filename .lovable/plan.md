# Email-Driven Wallet & POP Flow

## Goal
Every email that touches CryptoPOP (event RSVP, signup, etc.) gets a deterministic TXC wallet created server-side. Any POP awarded to that email is sent on-chain to that wallet. When the person later signs in, the same wallet is claimed by their `auth.uid`.

## Model

**One wallet per email**, derived from a master seed + email. Identity progression:
1. Anonymous RSVP with email → wallet exists, POP credits accumulate as a "pending" on-chain payout (or sent immediately if we choose).
2. User signs up/logs in with that same email → wallet is linked to their `auth.uid`, future POP keeps flowing to it.

## Changes

### 1. Database
New table `email_wallets`:
- `email` (PK, lowercased)
- `wallet_address`
- `derivation_index` (sequential, for HD path)
- `claimed_by_user_id` (nullable, set when auth user with matching email appears)
- `created_at`

New table `pop_awards` (ledger of awards owed/sent per email):
- `email`, `wallet_address`, `amount`, `source` (e.g. `event_signup`, `rsvp`, `quiz`), `source_id`, `tx_hash` (nullable), `status` (`pending` | `sent` | `failed`), timestamps

RLS: service-role-only writes; users can read their own rows via `claimed_by_user_id = auth.uid()`.

Keep existing `wallet_backups` for authenticated users' encrypted seeds (unchanged).

### 2. Server functions / helpers
- `ensureEmailWallet(email)` — server fn: lowercases email, derives next HD index from a master seed (stored in `MINTER_WIF` or a new `WALLET_MASTER_SEED` secret), inserts `email_wallets` row idempotently, returns address.
- `awardPop({ email, amount, source, sourceId })` — server fn: ensures wallet, inserts `pop_awards` row, enqueues an on-chain send (or sends immediately via TXC RPC), updates status/tx_hash.
- `claimWalletForUser(userId, email)` — runs on auth state change / profile creation: links `email_wallets.claimed_by_user_id`.

### 3. Wire-up points
- `event_signups` insert path → call `ensureEmailWallet` + `awardPop` for the 10 POP signup credit.
- `event_rsvps` insert path → same.
- Existing quiz / referral / claim flows → route through `awardPop` instead of writing directly to balance.
- Auth: on `handle_new_user` trigger (or post-signup server fn), call `claimWalletForUser` so the seamless handoff happens.

### 4. UI
- Confirmation email already exists; add wallet address + POP balance to it.
- Authenticated dashboard shows the same wallet (now claimed) and on-chain balance.

## Open questions before I build

1. **Send POP on-chain immediately, or batch?** Immediate = simpler UX, more TXC tx fees. Batched (cron every N min) = cheaper, slight delay. Which?
2. **Master seed source** — reuse `MINTER_WIF` for derivation, or add a dedicated `WALLET_MASTER_SEED` secret? (Dedicated is cleaner; minter stays a hot wallet for sending.)
3. **Email collision policy** — if someone RSVPs with email X, then later signs up with Google using email X, auto-claim the wallet? (I'd say yes.)
4. **Server-side custody** — these email-only wallets have no user-held key until claim. Confirm OK with custodial-until-claimed model.

Answer those four and I'll implement.