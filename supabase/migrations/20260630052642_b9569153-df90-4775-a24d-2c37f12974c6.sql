
DROP POLICY IF EXISTS "anyone can request a market" ON public.market_requests;

CREATE POLICY "anyone can request a market"
  ON public.market_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND length(btrim(city)) BETWEEN 1 AND 120
    AND length(btrim(name)) BETWEEN 1 AND 120
    AND length(btrim(email)) BETWEEN 3 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (region IS NULL OR length(region) <= 120)
    AND (country IS NULL OR length(country) <= 120)
    AND (why IS NULL OR length(why) <= 2000)
  );
