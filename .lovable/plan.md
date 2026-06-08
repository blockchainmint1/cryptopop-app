# Why your wallet shows 0 POP

I dug into the database for your signup:

- `event_signups.pop_credits` = **10** (set at signup, as expected)
- `email_wallets` row exists with a TXC address ✓
- `pop_awards` ledger has **0 rows** for your email ✗

The `/my-pop` page intentionally shows the **ledger sum** (what's actually been awarded/sent on-chain) rather than the raw `pop_credits` column. Since no ledger row exists, the page shows 0 POP — even though the signup itself succeeded.

## Root cause

In `src/lib/signups.functions.ts`, `createEventSignup` calls `awardPop(...)` **fire-and-forget**:

```ts
awardPop({ ... }).catch(e => console.error(...));
```

The server runs on Cloudflare Workers, where background tasks **are killed the moment the HTTP response is sent**. That's why the ledger insert + on-chain `mintGrant` never ran. (The `claimPop` function already documents this gotcha and awaits inline for the same reason.)

The email confirmation enqueue has the same fire-and-forget pattern, but it's writing to a durable queue table inside its first DB call, so it's been getting through. `awardPop` does more async work after the insert (the mint broadcast) and isn't surviving.

## Fix

1. **`src/lib/signups.functions.ts`** — `await awardPop(...)` inside `createEventSignup`, before returning. Wrap in `try/catch` so a mint failure doesn't break signup (we still want `pop_awards` row written with `status: 'failed'` so we can retry).
2. **Backfill** the missing award for the existing signup (`bobby@blockchainmint.com`, signup id `117344f2…`) by inserting a `pop_awards` row via the same path — easiest is a one-off server call after the fix lands, or a small migration that inserts the row directly and lets the next mint retry pick it up.
3. **Add a "retry pending/failed awards" admin path** (optional, small) — a server fn that finds `pop_awards` with `status in ('pending','failed')` and re-runs `mintGrant`. Useful operationally and as a safety net.

## What the user will see after the fix

- New signup → ledger row immediately written (`status: pending` → `sent` once mint broadcasts) → `/my-pop` reflects 10 POP.
- If the on-chain mint fails (TXC node down, etc.), the row stays `status: failed` but `/my-pop` still shows 10 because the reconcile counts `pending`+`sent`. Mint can be retried later without double-spending (the ledger has the unique `(source, source_id)` constraint).

## Open question

The same fire-and-forget pattern likely affects RSVPs too (`src/routes/events.$slug.rsvp.tsx` flow). Want me to audit that in the same pass, or keep this scoped to event signups for now?
