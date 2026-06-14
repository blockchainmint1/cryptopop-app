ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS qr_active_minutes_before integer NOT NULL DEFAULT 0
CHECK (qr_active_minutes_before >= 0 AND qr_active_minutes_before <= 1440);