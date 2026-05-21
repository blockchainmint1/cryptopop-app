
CREATE TABLE public.event_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile_number text NOT NULL,
  email text NOT NULL,
  instagram_handle text,
  telegram_handle text,
  is_friend boolean NOT NULL DEFAULT false,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  pop_credits numeric NOT NULL DEFAULT 0,
  completed_activities text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_signups_email ON public.event_signups (email);

ALTER TABLE public.event_signups ENABLE ROW LEVEL SECURITY;

-- Public can submit a signup with basic length/format checks
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
  AND pop_credits = 0
  AND completed_activities = '{}'::text[]
);

-- Admins can read everything
CREATE POLICY "Admins view all signups"
ON public.event_signups
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update (e.g. mark activities, adjust POP credits)
CREATE POLICY "Admins update signups"
ON public.event_signups
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins delete signups"
ON public.event_signups
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Keep updated_at fresh
CREATE TRIGGER trg_event_signups_updated_at
BEFORE UPDATE ON public.event_signups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
