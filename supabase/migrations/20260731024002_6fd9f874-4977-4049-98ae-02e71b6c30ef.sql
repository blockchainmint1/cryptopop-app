ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity integer;

INSERT INTO public.events (
  name, description, slug, lat, lng, radius_m, start_at, end_at,
  base_reward, referral_reward, time_zone, org_id, created_by,
  visibility, qr_active_minutes_before, capacity
)
SELECT
  'NectarPay Training with Tim Blake',
  'A full day of NectarPay training with Tim Blake at Springhill Suites in McKinney, Texas. 9am to 5pm, only 40 spots available. Earn 10 POP for registering and 25 POP when you show up.',
  'nectarpay-training-mckinney',
  33.1656, -96.6289, 500,
  '2026-08-05T14:00:00Z', '2026-08-05T22:00:00Z',
  10, 25, 'America/Chicago',
  '4774aa4d-ccd8-42eb-aa06-db50dfcbe6eb',
  'b4cda587-c07b-4977-ad7b-2608768bb7e4',
  'public', 60, 40
WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE slug = 'nectarpay-training-mckinney');

INSERT INTO public.reward_rules (action_key, label, description, pop_amount, enabled, org_id)
SELECT 'event_signup', 'Event signup', 'POP awarded when someone registers for an event', 10, true,
  '4774aa4d-ccd8-42eb-aa06-db50dfcbe6eb'
WHERE NOT EXISTS (SELECT 1 FROM public.reward_rules WHERE action_key = 'event_signup');