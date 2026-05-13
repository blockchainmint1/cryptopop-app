# Scanner + Claim Flow

Build the core "scan → earn POP" loop. QR signing, server-side claim verification, instant balance credit, and an admin tool to mint event QRs. Chain settlement stays stubbed until the end.

## What ships

1. **Organizer-side: signed QR generator**
   A `/admin/events/$id` page (admin role only) that generates the printable event QR. The QR encodes `cryptopop://claim?e={event_id}&s={hmac}` where the HMAC is computed server-side with `QR_HMAC_SECRET` over the event_id. Static — one QR per event, valid for the event's lifetime.

2. **Attendee-side: scanner**
   `/_authenticated/scan` route. Camera viewfinder using `@yudiel/react-qr-scanner`. On detect → parse → call claim server fn. Also accepts pasted/typed codes as a fallback (testing without a printed QR).

3. **Claim server function** (`claimPop`, auth-protected)
   - Parses QR payload, verifies HMAC against `QR_HMAC_SECRET`
   - Loads the event, checks `now()` is within `start_at`/`end_at`
   - Receives the user's GPS coords from the client, computes haversine distance vs `events.lat/lng`, hard-rejects if outside `radius_m`
   - Checks `claims` for existing row (user_id, event_id) — one claim per event per user
   - Loads `profiles.wallet_address` (the receiving TXC address)
   - Inserts a `claims` row (status `pending`, base_reward = `events.base_reward`, total = base for now), upserts `pop_balance_mirror` (+= total, events_attended += 1)
   - Returns `{ ok: true, event, reward }` for the success screen
   - Quiz reward and referral reward are wired in later passes

4. **Claim result screen**
   Shows event name + cover, "+N POP earned", confetti-ish accent, CTAs to Wallet or Scan again. Failure states: outside geofence, event not started/ended, already claimed, invalid QR.

5. **Wallet integration**
   Add a "Scan to earn" button on the wallet view linking to `/scan`. Recent claims list (last 5) under the balance card.

6. **DB writes — RLS**
   `claims` and `pop_balance_mirror` currently have no insert/update policies. The claim server fn uses the **admin client** (`supabaseAdmin`) for the writes after authenticating via `requireSupabaseAuth` — RLS stays locked down for direct client writes (correct posture; users can never self-credit).

7. **Demo seed**
   One demo event near a coordinate I'll ask you to pick (or use a wide test radius covering you), printed-out QR available in the admin page so you can scan from your phone against your laptop screen.

## What does NOT ship in this pass
- Real OP_RETURN minting on TXC (stubbed; `claims.tx_hash` stays null, `status` stays `pending`)
- Quiz flow (next pass)
- Referral attribution (next pass)
- Admin event creator UI (we'll insert the demo event via a data tool)

## Technical notes (for reference, not user-facing)

- **HMAC**: SHA-256, hex, computed server-side only. Format: `hmac(QR_HMAC_SECRET, event_id)` — static binding is fine because QR is static by design; geofence + time window + one-claim-per-user are the real defenses.
- **Geofence**: client uses `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`, sends lat/lng to the server fn. Server recomputes distance — never trust a client-side "I'm in range" boolean. Reject `accuracy > 100m` to prevent IP-geo spoofing on desktop.
- **Files added**:
  - `src/lib/qr.functions.ts` — `signEventQr({ eventId })` (admin-only) and `claimPop({ qr, lat, lng, accuracy })`
  - `src/lib/qr.server.ts` — HMAC + haversine helpers
  - `src/routes/_authenticated.scan.tsx` — scanner
  - `src/routes/_authenticated.scan.success.tsx` — result
  - `src/routes/_authenticated.admin.events.$id.tsx` — QR poster page (gated by `has_role('admin')`)
- **Package adds**: `@yudiel/react-qr-scanner` (camera + decode in one component, actively maintained).
- **Migration needed**: none for schema. We do need to grant the current logged-in user the `admin` role so they can see the QR poster — I'll do that as a one-line data insert and ask you to confirm.

## Order of operations

1. Migration-free: add `admin` role to your user (`bobby@blockchainmint.com`) via data insert
2. Insert one demo event near a coordinate you give me (or 2km radius around your office)
3. Build qr.server + qr.functions (HMAC sign + claim verify)
4. Build admin QR poster page
5. Build scanner + result screens
6. Wire "Scan to earn" + recent claims into the wallet view

After this, the loop is: print QR → walk to event → scan → POP appears in your wallet. Quiz and referrals layer on next.
