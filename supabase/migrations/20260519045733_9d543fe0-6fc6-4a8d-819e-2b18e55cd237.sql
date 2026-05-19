CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug text NOT NULL,
  event_name text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  contact_number text NOT NULL,
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size >= 1 AND party_size <= 20),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_rsvps_event_slug ON public.event_rsvps(event_slug);
CREATE INDEX idx_event_rsvps_created_at ON public.event_rsvps(created_at DESC);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an RSVP"
  ON public.event_rsvps FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(full_name) BETWEEN 1 AND 120
    AND length(email) BETWEEN 3 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(contact_number) BETWEEN 3 AND 32
    AND (notes IS NULL OR length(notes) <= 1000)
  );

CREATE POLICY "Admins view all RSVPs"
  ON public.event_rsvps FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));