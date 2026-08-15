INSERT INTO public.pop_markets (slug, city, region, country, status, lat, lng, sort_order)
VALUES ('manila', 'Manila', 'NCR', 'Philippines', 'live', 14.5995, 120.9842, 70)
ON CONFLICT (slug) DO UPDATE SET status = 'live', lat = EXCLUDED.lat, lng = EXCLUDED.lng;