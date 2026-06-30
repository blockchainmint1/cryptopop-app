
-- Markets
CREATE TABLE public.pop_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  city text NOT NULL,
  region text,
  country text NOT NULL DEFAULT 'USA',
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('live','coming_soon')),
  hero_copy text,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  launched_at timestamptz,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pop_markets TO anon, authenticated;
GRANT ALL ON public.pop_markets TO service_role;
ALTER TABLE public.pop_markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "markets readable by all" ON public.pop_markets FOR SELECT USING (true);
CREATE POLICY "markets admin write" ON public.pop_markets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Market launch requests
CREATE TABLE public.market_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  region text,
  country text,
  name text NOT NULL,
  email text NOT NULL,
  why text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','approved','declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.market_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.market_requests TO authenticated;
GRANT ALL ON public.market_requests TO service_role;
ALTER TABLE public.market_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can request a market" ON public.market_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "admins read market requests" ON public.market_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update market requests" ON public.market_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Merchants
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_slug text NOT NULL REFERENCES public.pop_markets(slug) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  address text,
  lat double precision,
  lng double precision,
  pop_per_visit int NOT NULL DEFAULT 5,
  website text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.merchants TO anon, authenticated;
GRANT ALL ON public.merchants TO service_role;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchants public read" ON public.merchants FOR SELECT USING (is_active = true);
CREATE POLICY "merchants admin write" ON public.merchants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_markets BEFORE UPDATE ON public.pop_markets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_merchants BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed 6 launch markets
INSERT INTO public.pop_markets (slug, city, region, country, lat, lng, status, hero_copy, sort_order, launched_at) VALUES
  ('dallas',     'Dallas',     'TX', 'USA',       32.7767,  -96.7970, 'live',        'Where it started. Big city, bigger community.', 10, now()),
  ('los-angeles','Los Angeles','CA', 'USA',       34.0522, -118.2437, 'coming_soon', 'POPups across LA neighborhoods.',                20, NULL),
  ('denver',     'Denver',     'CO', 'USA',       39.7392, -104.9903, 'coming_soon', 'Mile-high meetups and merchant love.',           30, NULL),
  ('nashville',  'Nashville',  'TN', 'USA',       36.1627,  -86.7816, 'coming_soon', 'Music City small business support.',             40, NULL),
  ('salt-lake',  'Salt Lake',  'UT', 'USA',       40.7608, -111.8910, 'coming_soon', 'Outdoors, indoors, and everywhere between.',     50, NULL),
  ('singapore',  'Singapore',  NULL, 'Singapore',  1.3521,  103.8198, 'coming_soon', 'Our Asia flagship market.',                       60, NULL);
