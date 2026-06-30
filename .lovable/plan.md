
## 1. Curated markets (Dallas, LA, Denver, Nashville, Salt Lake, Singapore)

- Add `pop_markets` table (slug, city, region, country, lat, lng, status: live/coming-soon, org_id nullable, launched_at, hero copy).
- Seed the 6 markets. Dallas = live (default org). Others = coming-soon.
- New `market_requests` table (city, name, email, why, status). Public insert via server fn with rate-limit + zod; admin read via existing admin gate.
- Demote `/start` self-mint: remove from header/footer/CTAs. Leave route accessible only via direct URL or admin invite. Add a small "Bring POP to your city →" link in footer that points to new `/markets/request` form.
- Add `/markets` index page (grid of 6 cities, live vs coming-soon badges) and link from header.

## 2. `/how-it-works` — narrative user journey

Single scrolling page, 5 stages with screenshots/icons:
1. **Discover** — find a POPup event or merchant in your city
2. **Show up** — RSVP gets you a digital pass
3. **Scan** — QR at venue mints POP to your wallet
4. **Earn more** — bring a friend, share, complete activities
5. **Support local** — spend time + attention at participating merchants

Includes the new tagline system + a "What is POP?" plain-English block + FAQ.

## 3. `/earn` — earning catalog + leaderboard + heatmap

Sections:
- **Ways to earn** — categories (Attend, Share, Support local, Learn, Refer) with action cards driven by `reward_rules` table (already exists). Show POP amount per action.
- **Where to earn** — merchant directory (new `merchants` table: name, city, market_slug, category, address, lat/lng, pop_per_visit, website, logo). Seed empty per market; admin can add later. Grouped by market.
- **Top POP leaderboard** — server fn aggregates `pop_awards` by recipient with tabs Day/Week/Month/Quarter/All-time. Display name from `profiles`, masked when missing. Live data; empty state when none.
- **POPup heatmap** — Google Maps with weighted markers from `qr_redemptions` joined to `qr_codes.lat/lng` (or merchant coords). Time-window matching leaderboard.
- **Recent activity** ticker — last 20 awards.

All queries are server fns using service-role client, returning only non-PII (display_name, city, amount, time, market).

## 4. Tagline & messaging system

Hero tagline options I'll wire across hero + meta + og:
- Primary: **"Small business support, gamified."**
- Sub: **"Show up. Support local. Earn POP."**
- Brand pillars expand to 4: **Connect · Experience · Support · Learn**

I'll also draft 4 short explainers used in different surfaces (homepage hero, /how-it-works intro, /earn intro, footer one-liner).

## 5. Header/footer cleanup

- Header: Home · Markets · How it works · Earn · (Sign in)
- Footer "Bring POP to your city" small link → /markets/request
- Remove the prominent "Start a community" CTA from homepage; keep the route alive.

## Technical notes

- New tables: `pop_markets`, `market_requests`, `merchants`. All have GRANTs + RLS (markets/merchants public-read for anon; market_requests insert-only for anon, admin read).
- New server fns: `getMarkets`, `requestMarket`, `getMerchants`, `getLeaderboard({window})`, `getHeatmap({window})`, `getEarnActions`.
- Heatmap uses existing GOOGLE_MAPS_API_KEY connector. Falls back to a static city-bubble view if maps fail.
- No changes to wallet/POP minting pipeline.

## Out of scope this turn

- Merchant onboarding flows / claim-your-business
- POP redemption at merchants (just display the rule for now)
- City-pages per market (`/markets/dallas` etc.) — stub linking to filtered /earn view
