
# CryptoPOP — MVP Plan

A mobile-first PWA-style web app that looks and feels like the brand: dark backgrounds, neon purple/pink/cyan/lime gradients, Bebas Neue headers, Poppins body. Core loop = **scan QR at event → verify → answer quiz → receive POP on-chain**.

---

## 1. Brand & design system

- Colors as CSS tokens in `src/styles.css` (oklch): bg `#0A0A0F`-ish, primary `#8B3DFF`, pink `#FF3DBE`, cyan `#00E5FF`, lime `#CCF695`, off-white `#F5F5F5`.
- Brand gradient token (purple → pink → cyan) + glow shadow tokens.
- Fonts: Bebas Neue (headings, ALL CAPS) + Poppins (body) via Google Fonts.
- Reusable `<GradientButton>`, `<NeonCard>`, `<GlowBadge>` styled atop shadcn primitives.
- Logo + brand assets copied from the Drive folder into `src/assets/`.

## 2. Auth & profiles

- **Lovable Cloud** enabled. Auth = email magic link only.
- `profiles` table: `id (auth.users.id)`, `username` (unique), `display_name`, `avatar_url`, `bio`, `wallet_address` (TXC pubkey), `created_at`. Trigger auto-creates row on signup.
- `user_roles` table + `app_role` enum (`admin`, `user`) + `has_role()` SECURITY DEFINER for the admin UI gate.
- Avatar upload via Lovable Cloud Storage bucket `avatars`.

## 3. Non-custodial wallet (TXC / EVM-style)

- On first login: generate a wallet in-browser with `viem` (`generatePrivateKey` + `privateKeyToAccount`).
- Show 12/24-word mnemonic backup screen *once*, force user to confirm "I saved it".
- Encrypt private key with a user-chosen PIN (Web Crypto AES-GCM) and store in `localStorage` + IndexedDB on device. Never sent to server.
- Server only stores the public **address** in `profiles.wallet_address`.
- "Restore wallet" flow: paste mnemonic → re-derive → set new PIN.
- Wallet UI in v1 shows: address (copy + QR), POP balance (read from contract via public RPC). **Send/Receive UI hidden behind a "Coming soon" tab.**

## 4. QR scan → mint flow (the core loop)

1. User taps **Scan**. We use `@zxing/browser` for camera-based QR decoding (works in mobile Safari/Chrome).
2. Decoded payload = `cryptopop://event/{eventId}?sig={hmac}` — HMAC signed with server secret so random QRs don't trigger anything.
3. App requests browser geolocation; sends `{eventId, sig, lat, lng, walletAddress}` to a **server function** `claimPOP`.
4. Server validates: HMAC, event time window (now between `start_at` & `end_at`), distance to event geofence ≤ `radius_m`, and that this `(user_id, event_id)` hasn't already claimed.
5. If quiz exists: server returns quiz; user answers; submits answers to `submitQuiz`.
6. If referral was scanned (see §5), server credits referral bonus to both parties.
7. Server computes total POP, then **mints on TXC**: signs `mint(toAddress, amount)` on the POP ERC-20 contract using the funded minter key, broadcasts via TXC RPC, returns tx hash.
8. UI shows celebratory animation + tx hash + new balance.

All claim attempts logged in `claims` table (status: `pending`/`minted`/`failed`, tx_hash, error).

## 5. Referral / "bring a friend"

- Each user has a personal invite QR (`cryptopop://ref/{userId}?sig=...`) on their profile.
- Friend, while on the event-claim flow, taps **Add referrer** and scans referrer's QR.
- Server credits referrer + referee bonus once per `(referrer, referee, event)` triple. Anti-self-referral check.

## 6. Events & admin UI

Admin-only routes under `/_authenticated/_admin/` (gated by `has_role('admin')`):
- `/admin/events` — list + create/edit events: name, description, cover image, lat/lng (map picker via Leaflet + OSM tiles), radius (m), start/end, base POP reward, optional quiz (questions + correct answers + per-question POP).
- Event create returns a downloadable PNG QR code (with logo overlay) for printing/displaying at the venue.
- `/admin/claims` — table of recent claims with status + retry-mint button for failed ones.

## 7. Leaderboard & social (lightweight v1)

- `/leaderboard` — top 50 users by POP balance (read off-chain mirror in DB for speed; reconciled from chain on a schedule).
- Each row: avatar, username, POP. Tap → public profile (avatar, bio, total POP, events attended count).

## 8. Navigation / IA

Bottom tab bar (mobile-first):
- **Home** — upcoming/recent events the user attended, latest POP earned.
- **Scan** (center, prominent gradient button) — opens camera.
- **Wallet** — address, balance, history (Send/Receive marked Coming soon).
- **Leaderboard**.
- **Profile** — avatar, bio, my invite QR, settings, logout.

Public landing route `/` for logged-out: brand hero, "what is CryptoPOP", CTA to sign in.

## 9. Routes (TanStack Start, file-based)

```
src/routes/
  __root.tsx
  index.tsx                          (landing, public)
  login.tsx                          (magic link)
  wallet-setup.tsx                   (generate/restore + PIN)
  _authenticated.tsx                 (gate: session + wallet)
  _authenticated/home.tsx
  _authenticated/scan.tsx
  _authenticated/claim.$eventId.tsx  (post-scan: quiz + confirm)
  _authenticated/wallet.tsx
  _authenticated/leaderboard.tsx
  _authenticated/profile.tsx
  _authenticated/u.$username.tsx     (public profile view)
  _authenticated/_admin.tsx          (gate: has_role('admin'))
  _authenticated/_admin/events.tsx
  _authenticated/_admin/events.$id.tsx
  _authenticated/_admin/claims.tsx
  api/public/health.ts
```

---

## Technical details

**Stack additions (npm):** `viem` (wallet + on-chain), `@zxing/browser` (QR scan), `qrcode` (QR generate), `leaflet` + `react-leaflet` (admin map picker), `bip39` (mnemonic), `framer-motion` (celebrations), `zod` (validation).

**Database (Lovable Cloud / Postgres) — new tables:**
- `profiles` (see §2)
- `user_roles` + `app_role` enum + `has_role()`
- `events` — id, name, description, cover_url, lat, lng, radius_m, start_at, end_at, base_reward, qr_secret, created_by
- `event_quiz_questions` — id, event_id, question, options(jsonb), correct_index, reward
- `claims` — id, user_id, event_id, lat, lng, base_reward, quiz_reward, referral_reward, total, tx_hash, status, error, created_at; UNIQUE(user_id, event_id)
- `referrals` — id, referrer_id, referee_id, event_id, reward; UNIQUE(referrer_id, referee_id, event_id)
- `pop_balance_mirror` — user_id PK, balance, last_synced_at (read-cache for leaderboard)
RLS: profiles readable to all, writable by self; events readable to authenticated, writable to admins; claims readable by self + admins.

**Server secrets (Cloud):**
- `TXC_RPC_URL`, `TXC_CHAIN_ID`, `POP_CONTRACT_ADDRESS`
- `MINTER_PRIVATE_KEY` (signs mint txs)
- `QR_HMAC_SECRET` (signs event/referral QRs)

**Server functions (`createServerFn`, all under `src/lib/*.functions.ts`):**
- `getEventForClaim({ eventId, sig })` — validates QR, returns event meta + quiz
- `claimPOP({ eventId, sig, lat, lng, quizAnswers?, referrerSig? })` — runs the full validation → mint pipeline using `viem` `walletClient.writeContract({ ...mintAbi, args:[addr, amount] })`
- `getLeaderboard()`, `getProfile(username)`, `updateProfile(...)`
- Admin: `createEvent`, `updateEvent`, `listAllClaims`, `retryMint(claimId)`

Mint failures retry via a simple in-handler retry; persistent failures stay `failed` and surface in admin UI for manual retry. Tx hashes stored for transparency.

**On-chain reads:** browser uses public `viem` `publicClient` to read POP balance directly from contract — no server roundtrip needed for wallet screen.

---

## Out of scope for v1 (explicitly deferred)

- Send / receive / swap UI (wallet shows address + balance only)
- Full social feed, comments, follows
- Rotating QR codes (static + geofence + time window per your choice)
- Push notifications
- Native mobile wrappers (PWA install prompt only)

---

## Build order

1. Brand tokens + fonts + landing page
2. Auth (magic link) + profiles + roles
3. Wallet generation/restore + PIN encryption + wallet screen
4. Admin events CRUD + map picker + QR generator
5. Scan flow + claim server function + on-chain mint + celebration UI
6. Quiz + referral bonuses
7. Leaderboard + public profiles
8. Polish, QA on mobile viewport, PWA manifest
