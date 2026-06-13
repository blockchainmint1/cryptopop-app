
CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text NOT NULL,
  pop_reward integer NOT NULL CHECK (pop_reward > 0 AND pop_reward <= 1000000),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  radius_m integer CHECK (radius_m IS NULL OR (radius_m >= 10 AND radius_m <= 50000)),
  expires_at timestamptz NOT NULL,
  single_use boolean NOT NULL DEFAULT false,
  use_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_codes_geofence_pair CHECK (
    (lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL AND radius_m IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage qr_codes" ON public.qr_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER qr_codes_updated_at BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX qr_codes_token_idx ON public.qr_codes(token);
CREATE INDEX qr_codes_active_idx ON public.qr_codes(active, expires_at);

CREATE TABLE public.qr_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pop_amount integer NOT NULL,
  tx_hash text,
  status text NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_redemptions TO authenticated;
GRANT ALL ON public.qr_redemptions TO service_role;
ALTER TABLE public.qr_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own redemptions" ON public.qr_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX qr_redemptions_code_idx ON public.qr_redemptions(code_id);
CREATE INDEX qr_redemptions_user_idx ON public.qr_redemptions(user_id);
