
ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS signup_source text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

-- Case-insensitive uniqueness on email; uniqueness on mobile_number
CREATE UNIQUE INDEX IF NOT EXISTS event_signups_email_unique_idx
  ON public.event_signups (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS event_signups_mobile_unique_idx
  ON public.event_signups (mobile_number);

-- Trigger to award starter credits & mark signup activity server-side
CREATE OR REPLACE FUNCTION public.event_signups_apply_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.pop_credits := 10;
  NEW.completed_activities := ARRAY['signup']::text[];
  IF NEW.signup_source IS NULL OR length(NEW.signup_source) = 0 THEN
    NEW.signup_source := 'website';
  END IF;
  IF NEW.status IS NULL OR length(NEW.status) = 0 THEN
    NEW.status := 'confirmed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_signups_apply_defaults_trg ON public.event_signups;
CREATE TRIGGER event_signups_apply_defaults_trg
  BEFORE INSERT ON public.event_signups
  FOR EACH ROW EXECUTE FUNCTION public.event_signups_apply_defaults();

-- Loosen INSERT policy: credits/activities are set by trigger, not the client
DROP POLICY IF EXISTS "Anyone can submit a signup" ON public.event_signups;
CREATE POLICY "Anyone can submit a signup"
  ON public.event_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(full_name) BETWEEN 1 AND 120
    AND length(email) BETWEEN 3 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(mobile_number) BETWEEN 3 AND 32
    AND (instagram_handle IS NULL OR length(instagram_handle) <= 64)
    AND (telegram_handle IS NULL OR length(telegram_handle) <= 64)
  );
