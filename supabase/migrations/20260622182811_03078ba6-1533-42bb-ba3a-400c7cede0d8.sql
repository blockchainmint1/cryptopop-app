
-- =========================================================================
-- Security hardening
-- =========================================================================

-- 1. Event visibility column + tighter SELECT policy
DO $$ BEGIN
  CREATE TYPE public.event_visibility AS ENUM ('public', 'unlisted', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility public.event_visibility NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS events_visibility_idx ON public.events(visibility);

-- Replace the broad "any signed-in user can read everything" policy.
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;

CREATE POLICY "Signed-in users can view non-private events"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    visibility <> 'private'
    OR public.is_org_member(auth.uid(), org_id)
  );

-- 2. Move encrypted minter WIF out of organizations into an owners-only table
CREATE TABLE IF NOT EXISTS public.organization_wallet_secrets (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  encrypted_wif text NOT NULL,
  encryption_key_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service role only for app code; owners get explicit RLS read/write below.
-- (No grant to anon. No grant to authenticated by default.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_wallet_secrets TO authenticated;
GRANT ALL ON public.organization_wallet_secrets TO service_role;

ALTER TABLE public.organization_wallet_secrets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organization_wallet_secrets_set_updated_at
  BEFORE UPDATE ON public.organization_wallet_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Owners read wallet secret"
  ON public.organization_wallet_secrets FOR SELECT
  TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]));

CREATE POLICY "Owners insert wallet secret"
  ON public.organization_wallet_secrets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]));

CREATE POLICY "Owners update wallet secret"
  ON public.organization_wallet_secrets FOR UPDATE
  TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]));

CREATE POLICY "Owners delete wallet secret"
  ON public.organization_wallet_secrets FOR DELETE
  TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]));

-- Migrate any existing ciphertext from organizations
INSERT INTO public.organization_wallet_secrets (org_id, encrypted_wif)
SELECT id, minter_wallet_encrypted_wif
FROM public.organizations
WHERE minter_wallet_encrypted_wif IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;

-- Drop the now-isolated column from organizations
ALTER TABLE public.organizations DROP COLUMN IF EXISTS minter_wallet_encrypted_wif;
