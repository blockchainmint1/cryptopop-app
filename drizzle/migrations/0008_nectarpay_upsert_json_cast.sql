-- json_to_recordset() only accepts json, not jsonb, so cast the batch before
-- expanding it. Same function, same privileges, one cast added.
CREATE OR REPLACE FUNCTION public.upsert_nectarpay_stores(p_rows jsonb, p_touch boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  WITH incoming AS (
    SELECT * FROM json_to_recordset(p_rows::json) AS x(
      id text, slug text, name text, category text, description text, logo_url text,
      presence text, listing text, status text,
      street text, city text, region text, postal_code text, country text,
      phone text, website text, hours text,
      accepts text[], lat double precision, lng double precision,
      source_updated_at timestamptz, is_active boolean
    )
  ), applied AS (
    INSERT INTO nectarpay_stores AS t (
      id, slug, name, category, description, logo_url, presence, listing, status,
      street, city, region, postal_code, country, phone, website, hours,
      accepts, lat, lng, pin_source, source_updated_at, is_active
    )
    SELECT
      id, slug, name, category, description, logo_url,
      coalesce(presence, 'physical'), coalesce(listing, 'city_only'), coalesce(status, 'live'),
      street, city, region, postal_code, country, phone, website, hours,
      coalesce(accepts, '{}'), lat, lng,
      CASE WHEN lat IS NOT NULL THEN 'feed' ELSE NULL END,
      source_updated_at, coalesce(is_active, true)
      FROM incoming
     ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        logo_url = EXCLUDED.logo_url,
        presence = EXCLUDED.presence,
        listing = EXCLUDED.listing,
        status = EXCLUDED.status,
        street = EXCLUDED.street,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        postal_code = EXCLUDED.postal_code,
        country = EXCLUDED.country,
        phone = EXCLUDED.phone,
        website = EXCLUDED.website,
        hours = EXCLUDED.hours,
        accepts = EXCLUDED.accepts,
        lat = COALESCE(EXCLUDED.lat, t.lat),
        lng = COALESCE(EXCLUDED.lng, t.lng),
        pin_source = CASE WHEN EXCLUDED.lat IS NOT NULL THEN 'feed' ELSE t.pin_source END,
        source_updated_at = EXCLUDED.source_updated_at,
        is_active = EXCLUDED.is_active
      WHERE t.source_updated_at IS DISTINCT FROM EXCLUDED.source_updated_at
         OR t.is_active IS DISTINCT FROM EXCLUDED.is_active
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM applied;

  IF p_touch THEN
    UPDATE nectarpay_stores t
       SET last_seen_at = now()
      FROM (SELECT id FROM json_to_recordset(p_rows::json) AS x(id text)) i
     WHERE t.id = i.id;
  END IF;

  RETURN v_count;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_nectarpay_stores(jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_nectarpay_stores(jsonb, boolean) TO service_role;
