REVOKE SELECT (lat, lng, radius_m) ON public.events FROM anon;
REVOKE SELECT (lat, lng, radius_m) ON public.events FROM authenticated;

GRANT SELECT (
  id, org_id, name, slug, description, cover_url,
  start_at, end_at, time_zone,
  base_reward, referral_reward,
  qr_active_minutes_before,
  visibility,
  created_at, updated_at, created_by
) ON public.events TO authenticated;

GRANT SELECT (
  id, org_id, name, slug, description, cover_url,
  start_at, end_at, time_zone,
  base_reward, referral_reward,
  qr_active_minutes_before,
  visibility,
  created_at, updated_at, created_by
) ON public.events TO anon;