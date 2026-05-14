ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS qr_payload text,
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz NOT NULL DEFAULT now();