
ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid;

CREATE INDEX IF NOT EXISTS event_signups_full_name_idx
  ON public.event_signups (lower(full_name));
