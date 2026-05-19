ALTER TABLE public.event_rsvps ADD COLUMN heard_from text;
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_insert_check;
ALTER TABLE public.event_rsvps ADD CONSTRAINT event_rsvps_heard_from_len CHECK (heard_from IS NULL OR length(heard_from) <= 120);