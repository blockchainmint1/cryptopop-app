
ALTER TABLE public.pop_markets
  ADD COLUMN IF NOT EXISTS short_slug text,
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS manager_title text,
  ADD COLUMN IF NOT EXISTS manager_bio text,
  ADD COLUMN IF NOT EXISTS manager_photo_url text,
  ADD COLUMN IF NOT EXISTS intro text;

CREATE UNIQUE INDEX IF NOT EXISTS pop_markets_short_slug_key ON public.pop_markets (short_slug) WHERE short_slug IS NOT NULL;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS market_slug text;

CREATE TABLE IF NOT EXISTS public.market_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_slug text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.market_news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_news TO authenticated;
GRANT ALL ON public.market_news TO service_role;

ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_news public read" ON public.market_news;
CREATE POLICY "market_news public read" ON public.market_news FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "market_news admin manage" ON public.market_news;
CREATE POLICY "market_news admin manage" ON public.market_news FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS market_news_updated_at ON public.market_news;
CREATE TRIGGER market_news_updated_at BEFORE UPDATE ON public.market_news
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE public.pop_markets SET short_slug = 'dallas' WHERE slug = 'dallas';
UPDATE public.pop_markets SET short_slug = 'lax' WHERE slug = 'los-angeles';
UPDATE public.pop_markets SET short_slug = 'denver' WHERE slug = 'denver';
UPDATE public.pop_markets SET short_slug = 'nashville' WHERE slug = 'nashville';
UPDATE public.pop_markets SET short_slug = 'slc' WHERE slug = 'salt-lake';
UPDATE public.pop_markets SET short_slug = 'singapore' WHERE slug = 'singapore';

UPDATE public.pop_markets
SET manager_name = 'Melina Reyes',
    manager_title = 'Dallas Market Manager',
    manager_bio = 'Melina runs the Dallas market day to day — recruiting merchants, hosting POPups, and making sure every member gets a warm welcome. If you want to bring your business into CryptoPOP or host an event, she''s your person.',
    intro = 'Dallas is home base. It''s where CryptoPOP started, where our HQ community meets, and where the first merchants said yes. Expect frequent meetups, scavenger hunts, and small businesses across DFW handing out POP for showing up, exploring, and spending local.'
WHERE slug = 'dallas';

INSERT INTO public.merchants (market_slug, name, category, address, lat, lng, pop_per_visit, website, is_active, sort_order) VALUES
  ('dallas', 'Deep Ellum Coffee Co.', 'Coffee', '2650 Main St, Dallas, TX', 32.7840, -96.7810, 10, NULL, true, 10),
  ('dallas', 'Bishop Arts Bookshop', 'Retail', '408 N Bishop Ave, Dallas, TX', 32.7495, -96.8280, 15, NULL, true, 20),
  ('dallas', 'Trinity Groves Taqueria', 'Food', '3011 Gulden Ln, Dallas, TX', 32.7784, -96.8290, 10, NULL, true, 30),
  ('dallas', 'McKinney Square Makers', 'Retail', '111 N Tennessee St, McKinney, TX', 33.1976, -96.6153, 20, NULL, true, 40),
  ('dallas', 'Plano Fitness Collective', 'Wellness', '1900 Preston Rd, Plano, TX', 33.0510, -96.8020, 15, NULL, true, 50)
ON CONFLICT DO NOTHING;

INSERT INTO public.market_news (market_slug, title, body, published_at) VALUES
  ('dallas', 'Dallas merchant map goes live', 'The first wave of DFW merchants is on the map. Visit, scan, and stack POP at coffee shops, bookstores, taquerias and more.', now() - interval '2 days'),
  ('dallas', 'NectarPay training comes to McKinney', 'A full day with Tim Blake at Springhill Suites — 40 seats only. 10 POP to register, 25 POP at the door.', now() - interval '7 days'),
  ('dallas', 'HQ community nights are back', 'Monthly meetups at HQ: demos, POP drops, and a chance to meet the merchants building this market with us.', now() - interval '18 days');

UPDATE public.events SET market_slug = 'dallas' WHERE slug = 'nectarpay-training-mckinney';
