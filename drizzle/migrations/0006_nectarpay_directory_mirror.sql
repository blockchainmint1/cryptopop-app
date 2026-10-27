-- NectarPay merchant directory mirror.
--
-- NectarPay (app.nectar-pay.com) publishes a free public feed of every store
-- that accepts crypto through them:
--   GET /api/public/v1/directory            -> every listed store
--   GET /api/public/v1/directory?since=<ts> -> stores changed since <ts>, plus
--                                             ids in `removed` that left the list.
--
-- We keep our own copy so the wallet reads instantly, the map keeps working
-- when NectarPay is slow, and we can add our own map pins on top. NectarPay
-- stays the source of truth: this table is written only by the sync job and is
-- read-only for the app (SELECT-only grants, no insert/update/delete policies).

CREATE TABLE public.nectarpay_stores (
  id text PRIMARY KEY,
  slug text,
  name text,
  category text,
  description text,
  logo_url text,
  presence text NOT NULL DEFAULT 'physical',
  listing text NOT NULL DEFAULT 'city_only',
  status text NOT NULL DEFAULT 'live',
  street text,
  city text,
  region text,
  postal_code text,
  country text,
  phone text,
  website text,
  hours text,
  accepts text[] NOT NULL DEFAULT '{}',
  lat double precision,
  lng double precision,
  pin_source text,
  source_updated_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT nectarpay_stores_pin_source_check
    CHECK (pin_source IS NULL OR pin_source IN ('feed', 'geocoded'))
);

CREATE TABLE public.nectarpay_sync_state (
  id integer PRIMARY KEY DEFAULT 1,
  cursor timestamptz,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_status text NOT NULL DEFAULT 'never',
  last_error text,
  last_count integer,
  last_removed integer,
  running_until timestamptz,
  CONSTRAINT nectarpay_sync_state_singleton CHECK (id = 1)
);

INSERT INTO public.nectarpay_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.nectarpay_stores TO anon, authenticated;
GRANT ALL ON public.nectarpay_stores TO service_role;
GRANT SELECT ON public.nectarpay_sync_state TO authenticated;
GRANT ALL ON public.nectarpay_sync_state TO service_role;

ALTER TABLE public.nectarpay_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nectarpay_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nectarpay_stores_read" ON public.nectarpay_stores
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "nectarpay_sync_state_read" ON public.nectarpay_sync_state
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX nectarpay_stores_active_idx ON public.nectarpay_stores (is_active, listing);
CREATE INDEX nectarpay_stores_needs_pin_idx ON public.nectarpay_stores (is_active, city)
  WHERE lat IS NULL;

-- Keep the copy fresh without anyone remembering to press a button: an hourly
-- database timer asks the wallet's own sync endpoint to pull the feed. The
-- endpoint is idempotent, rate limited and refuses to overlap itself, so a
-- missed hour simply means the copy is one hour older.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nectarpay-directory-sync') THEN
    PERFORM cron.unschedule('nectarpay-directory-sync');
  END IF;
END
$$;

SELECT cron.schedule(
  'nectarpay-directory-sync',
  '23 * * * *',
  $cmd$SELECT net.http_get(
    url := 'https://app.cryptopop.org/api/public/nectarpay-sync',
    timeout_milliseconds := 90000
  )$cmd$
);
