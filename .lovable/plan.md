## My take

This works, and the right shape is an **org-per-admin platform** (like Eventbrite + Loyalty + on-chain receipts). The two hardest pieces are (1) custody of each org's TXC minter wallet and (2) cleanly scoping every existing table to an org without breaking CryptoPOP USA. Everything else is incremental.

I'd **strongly recommend custodied minter wallets to start** (we hold the WIF, encrypted) — same model we use today, just one wallet per org instead of one global wallet. "Bring your own wallet" can come later as an upgrade. Otherwise onboarding becomes a 30-minute crypto tutorial and adoption dies.

I'd also recommend **defaulting new events to Unlisted** (link/QR only, not on the public directory). Admins opt in to Public per event. Protects token supply by default and matches how most community organizers actually think.

---

## Phases

### Phase 1 — Multi-tenancy foundation (no UI changes for existing users)
- New `organizations` table: name, slug, brand (logo/colors), `txc_property_id` (nullable until minted), `minter_wallet_address`, `minter_wallet_encrypted_wif`, `pop_token_symbol`, `pop_token_name`, status.
- New `organization_members` table: (org_id, user_id, role: owner/admin/staff). Replaces the global `user_roles='admin'` check for org-scoped actions. Global `admin` role stays for platform superadmin (you).
- Add `org_id` (nullable for migration, then NOT NULL) to: `events`, `qr_codes`, `pop_awards`, `claims`, `event_signups`, `reward_rules`, `event_quiz_questions`, `blast_campaigns`, `blast_recipients`.
- Migration: create `org_id = <CryptoPOP USA org>` and backfill every existing row to it. You become its owner.
- Rewrite every admin server fn to filter by `org_id` from context, not show all rows globally.

### Phase 2 — Public signup + onboarding
- Open signup (currently the app is invite-only-feeling). New `/start` flow: sign up → "Create your community" → org name, slug, brand colors, logo.
- Lands on a blank `/admin` dashboard scoped to that org with three big "next step" cards: **Mint your POP token → Create your first event → Print your QR poster**.
- Until token is minted, the rest of the dashboard is locked with explanatory copy.

### Phase 3 — Guided POP token minting
- "Mint POP Token" wizard:
  1. Pick token name + symbol (e.g. "Lakehouse POP", "LAKE") and total supply cap.
  2. Confirm — show estimated TXC fee, explain it's permanent + on-chain.
  3. Server: generate a new TXC issuer keypair, encrypt the WIF with a per-row key derived from `WALLET_ENCRYPTION_KEY` + org_id, store address + ciphertext.
  4. **Funding step**: show the new issuer address with a small TXC funding requirement (covers issuance + first ~100 mints). User sends TXC to it; we poll mempool.texitcoin.org until funded.
  5. Issue the Omni property (managed, indivisible) via `omni_sendissuancemanaged`, broadcast, wait for confirmation, store `txc_property_id` on the org.
- Refactor `src/lib/txc.server.ts` to take `propertyId` + `minterWif` from the org row instead of `process.env`. Existing CryptoPOP USA org row holds property #37 + current WIF so nothing breaks.

### Phase 4 — Per-event visibility + public directory
- Add `visibility` to `events`: `public | unlisted | private`. Default `unlisted`.
  - `public` — listed in `/discover` and the org's `/o/<slug>` page; anyone can RSVP and claim.
  - `unlisted` — accessible by direct link / QR only; not in directories.
  - `private` — RSVP requires invite or pre-added email; QR claim still respects geofence/time window.
- New routes:
  - `/discover` — public global directory; filter by location/date/org.
  - `/o/$slug` — org public page (brand, upcoming public events, "claimed X POP from this community" counter).
  - `/o/$slug/events/$event` — public event detail.
- Existing `/events/$slug/rsvp` continues to work for direct links.

### Phase 5 — Platform polish (after MVP works)
- Org switcher in the admin header (for users who belong to multiple orgs — staff at events, contractors).
- "Featured orgs" surface on homepage; CryptoPOP USA is the seed featured org and stays on the marketing site.
- Public API key per org for embedding their own POP balance widget.
- Bring-your-own-wallet upgrade path: rotate from custodial to external.

---

## Technical detail (engineer-facing)

**Permissions model**
- Keep global `user_roles` ('admin' = platform staff, only you to start).
- All admin server fns become: `assertOrgRole(userId, orgId, ['owner','admin'])` instead of `assertAdmin(userId)`. The `orgId` comes from a header, route param, or the org membership lookup for the resource's `org_id`.
- RLS: every org-scoped table gets a policy "user is a member of this row's org_id" via a `is_org_member(org_id, role[])` security-definer function.

**TXC refactor (low risk, mechanical)**
- `mintGrant({ to, amount })` → `mintGrant({ to, amount, propertyId, minterWif })`.
- Resolve those two from the award's `org_id` → org row before calling.
- Decrypt minterWif at call time; never log it. Encryption uses the existing `wallet-crypto.server` pattern.

**Backfill safety**
- Add `org_id` as nullable in migration A → backfill in migration B → set NOT NULL + FK + RLS in migration C. Three migrations, each reversible.

**Routes**
- `_authenticated/admin/*` becomes org-scoped via a parent layout that resolves the active org (from URL param or "last used" cookie) and provides it in context.
- New top-level public routes for discovery as above. Each gets its own loader + `head()` with org-/event-specific OG tags.

**Onboarding funding UX**
- "Send X TXC to this address" with a copy button, QR code of the address, and a live poller. Confirmation in ~1 block. If never funded, the wizard can resume later from the dashboard.

**What stays the same**
- The on-chain mint pipeline (`txc.server.ts`), POP awards reconciliation, QR signing/scanning, email blasts, geofence enforcement. All of it just gets `org_id` threaded through.

---

## Open question to resolve before Phase 3

**Funding the first 100 mints.** Two paths:
1. **Org pays.** Cleaner accounting, but means every new admin needs to acquire and send TXC before their first event — real friction.
2. **Platform sponsors a starter pool.** We send a small TXC float to each new org wallet on creation; pay it back from a future "creator fee" or org subscription. Best for adoption.

I'd pick #2 for launch, capped at e.g. enough TXC for ~50 mints. We can add billing later.
