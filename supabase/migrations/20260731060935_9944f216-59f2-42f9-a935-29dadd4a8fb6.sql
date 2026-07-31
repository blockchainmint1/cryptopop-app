DROP TRIGGER IF EXISTS event_signups_defaults ON public.event_signups;

CREATE OR REPLACE FUNCTION public.event_signups_apply_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.pop_credits := 10;
  NEW.completed_activities := ARRAY['signup']::text[];
  NEW.status := 'confirmed';
  NEW.checked_in_at := NULL;
  NEW.checked_in_by := NULL;
  NEW.guest_count := LEAST(GREATEST(COALESCE(NEW.guest_count, 0), 0), 20);
  IF NEW.signup_source IS NULL OR length(NEW.signup_source) = 0 THEN
    NEW.signup_source := 'website';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_signups_defaults
BEFORE INSERT ON public.event_signups
FOR EACH ROW EXECUTE FUNCTION public.event_signups_apply_defaults();

DROP POLICY IF EXISTS "Anyone can submit a signup" ON public.event_signups;

CREATE POLICY "Anyone can submit a signup"
ON public.event_signups
FOR INSERT
WITH CHECK (
  length(full_name) BETWEEN 1 AND 120
  AND length(email) BETWEEN 3 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (mobile_number IS NULL OR length(mobile_number) BETWEEN 3 AND 32)
  AND (instagram_handle IS NULL OR length(instagram_handle) <= 64)
  AND (telegram_handle IS NULL OR length(telegram_handle) <= 64)
  AND (external_wallet IS NULL OR length(external_wallet) <= 128)
  AND pop_credits = 10
  AND status = 'confirmed'
  AND checked_in_at IS NULL
  AND checked_in_by IS NULL
  AND completed_activities = ARRAY['signup']::text[]
  AND guest_count BETWEEN 0 AND 20
);