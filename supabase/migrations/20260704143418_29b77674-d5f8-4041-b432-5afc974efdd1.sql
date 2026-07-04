-- Allow admin-added guests without a phone number.
-- The unique index on mobile_number was colliding on empty strings when
-- multiple walk-ins were added without a phone, surfacing as a misleading
-- "already registered" error.

ALTER TABLE public.event_signups
  ALTER COLUMN mobile_number DROP NOT NULL;

-- Normalize any existing empty strings to NULL so the unique index treats
-- them as distinct (Postgres allows multiple NULLs in a UNIQUE index).
UPDATE public.event_signups
   SET mobile_number = NULL
 WHERE mobile_number = '';