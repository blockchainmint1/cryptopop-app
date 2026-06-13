# Admin QR Codes (`/admin/codes`)

A new admin tool to mint ad‑hoc QR codes that grant POP when scanned.

## Behaviour

Each QR code has:
- **Label** — internal name (e.g. "Booth A — Friday")
- **POP reward** — integer amount to mint per scan
- **Event** (optional) — links scan to an `events` row (for reporting)
- **Geofence** (optional) — `lat`, `lng`, `radius_m` (default 200m). When set, scanner's browser geolocation must be within radius
- **Expires at** — required UTC timestamp
- **Single‑use** — boolean. If true, first successful scan locks the code; if false, each *user* can only scan once (no farming)
- **Active** — admin can disable at any time

When a code is created, a random `token` (22+ char base62) is generated. The QR encodes `https://<host>/claim/<token>`.

## Scan flow (`/claim/$token`)

1. Route is **public** (top-level), shows a "Scanning…" screen.
2. If the visitor isn't signed in, render a "Sign in to claim" CTA that returns to the same URL.
3. Once signed in, client gets geolocation (only if the code has a geofence — fetched via a public lookup server fn that returns `requiresLocation`, `label`, `popReward`, `expired`, `disabled`).
4. POSTs to `redeemQrCode({ token, lat?, lng? })`:
   - Validates: not expired, active, geofence (haversine), single-use lock, per-user dedupe.
   - Mints POP via the existing `awardPop` ledger using `source = 'qr_code'`, `source_id = code_id + ':' + user_id` (idempotent).
   - Returns success/failure with reason.
5. Success screen shows amount + link to `/app`.

## Data model

New table `public.qr_codes`:

| column         | type                 | notes                                |
| -------------- | -------------------- | ------------------------------------ |
| id             | uuid PK              |                                      |
| token          | text UNIQUE          | URL-safe random, indexed             |
| label          | text                 | admin-facing                         |
| pop_reward     | integer              | >0                                   |
| event_id       | uuid NULL → events   | optional                             |
| lat, lng       | double precision NULL| geofence center (both or neither)    |
| radius_m       | integer NULL         | default 200                          |
| expires_at     | timestamptz          |                                      |
| single_use     | boolean              | default false                        |
| max_uses       | integer NULL         | computed: 1 when single_use else null|
| use_count      | integer              | default 0                            |
| active         | boolean              | default true                         |
| created_by     | uuid → auth.users    |                                      |
| created_at, updated_at | timestamptz  |                                      |

New table `public.qr_redemptions` (per-scan log, also serves as per-user dedupe):

| column      | type            | notes                          |
| ----------- | --------------- | ------------------------------ |
| id          | uuid PK         |                                |
| code_id     | uuid → qr_codes |                                |
| user_id     | uuid → auth.users |                              |
| pop_amount  | integer         |                                |
| tx_hash     | text NULL       | from award                     |
| status      | text            | 'sent' / 'failed' / 'duplicate'|
| lat, lng    | double precision NULL |                          |
| created_at  | timestamptz     |                                |

UNIQUE `(code_id, user_id)` enforces "one scan per user per code".

RLS:
- `qr_codes`: only admins manage; `requireSupabaseAuth` admin path used for create/list. Public lookup goes via `supabaseAdmin` in a server fn that returns only safe fields.
- `qr_redemptions`: user can see their own rows; admins see all.

Grants for both: `authenticated` SELECT/INSERT/UPDATE/DELETE, `service_role` ALL.

## Server functions (`src/lib/qr-codes.functions.ts`)

- `createQrCode(input)` — admin, inserts row, returns row + scan URL.
- `listQrCodes({ status })` — admin, lists with use counts.
- `updateQrCode({ id, active?, expires_at?, label?, … })` — admin.
- `deleteQrCode({ id })` — admin (soft via `active=false` keeps audit; we'll go hard delete + cascade redemptions on request).
- `lookupQrCode({ token })` — **public** (no auth), returns minimal info for the claim page: `{ label, popReward, requiresLocation, eventName, expired, disabled, exhausted }`.
- `redeemQrCode({ token, lat?, lng? })` — auth required, performs validation + `awardPop`, inserts `qr_redemptions`.

## Routes

- `src/routes/_authenticated.admin.codes.tsx` — list + "New code" dialog with: label, POP, event picker (optional), "Geofence this code" toggle revealing lat/lng/radius, expires_at, single-use toggle. Each row shows scan URL, copy-link, "Show QR" (renders QR using existing `qrcode` lib if installed, else lightweight inline via Google chart API — actually we'll add `qrcode` if not present), use count, disable/delete, expiry status.
- `src/routes/claim.$token.tsx` — public claim page (sign-in CTA + scan flow). Replaces nothing (existing `/app` claim flow stays).

Add a link to the admin dashboard quick-actions for "QR Codes".

## Validation

- `pop_reward`: int 1–1_000_000
- `radius_m`: int 10–50_000 when geofence enabled
- `expires_at`: must be future on create
- Either both `lat`/`lng` set or neither; if set, `radius_m` required.

## Out of scope (future)

- Bulk QR generation
- CSV export of redemptions
- Per-code reward tiers / quiz integration

## Open questions

1. **Hard delete vs deactivate?** Default: deactivate (`active=false`) so audit/log survives; hard delete available too.
2. **Anonymous scan?** Plan assumes scanner must sign in (so we have a wallet). If you want anonymous → wallet-by-email-on-the-spot flow, that's an extra phase.
