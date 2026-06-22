
-- =========================================================================
-- Phase 1A: Multi-tenancy foundation
-- =========================================================================

-- 1. Roles enum for org membership
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  logo_url text,
  accent_color text,
  -- POP token metadata
  pop_token_name text,
  pop_token_symbol text,
  txc_property_id integer,            -- Omni property id once minted
  minter_wallet_address text,
  minter_wallet_encrypted_wif text,   -- ciphertext only, never raw WIF
  -- Status / lifecycle
  status text NOT NULL DEFAULT 'active',  -- active | pending_token | suspended
  is_featured boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.organizations TO anon;
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. organization_members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS organization_members_user_idx
  ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS organization_members_org_idx
  ON public.organization_members(org_id);

-- 4. Security-definer membership helper (no recursion)
CREATE OR REPLACE FUNCTION public.has_org_role(
  _user_id uuid,
  _org_id uuid,
  _roles public.org_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND org_id  = _org_id
      AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND org_id  = _org_id
  )
$$;

-- 5. RLS policies

-- organizations: members can read their orgs; everyone can read featured/active
CREATE POLICY "Members can read their orgs"
  ON public.organizations FOR SELECT
  USING (
    public.is_org_member(auth.uid(), id)
    OR is_featured = true
  );

CREATE POLICY "Anon can read featured orgs"
  ON public.organizations FOR SELECT
  TO anon
  USING (is_featured = true AND status = 'active');

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update their orgs"
  ON public.organizations FOR UPDATE
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), id, ARRAY['owner']::public.org_role[]));

-- organization_members: members can see roster; owners can manage
CREATE POLICY "Members can read their org roster"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Owners can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]));

CREATE POLICY "Owners can update members"
  ON public.organization_members FOR UPDATE
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]));

CREATE POLICY "Owners can remove members"
  ON public.organization_members FOR DELETE
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner']::public.org_role[]));

-- 6. Add nullable org_id columns to scoped tables
ALTER TABLE public.events             ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.qr_codes           ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pop_awards         ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.claims             ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.event_signups      ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.reward_rules       ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.event_quiz_questions ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.blast_campaigns    ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.blast_recipients   ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS events_org_idx              ON public.events(org_id);
CREATE INDEX IF NOT EXISTS qr_codes_org_idx            ON public.qr_codes(org_id);
CREATE INDEX IF NOT EXISTS pop_awards_org_idx          ON public.pop_awards(org_id);
CREATE INDEX IF NOT EXISTS claims_org_idx              ON public.claims(org_id);
CREATE INDEX IF NOT EXISTS event_signups_org_idx       ON public.event_signups(org_id);
CREATE INDEX IF NOT EXISTS reward_rules_org_idx        ON public.reward_rules(org_id);
CREATE INDEX IF NOT EXISTS event_quiz_questions_org_idx ON public.event_quiz_questions(org_id);
CREATE INDEX IF NOT EXISTS blast_campaigns_org_idx     ON public.blast_campaigns(org_id);
CREATE INDEX IF NOT EXISTS blast_recipients_org_idx    ON public.blast_recipients(org_id);

-- 7. Seed CryptoPOP USA org + backfill
WITH new_org AS (
  INSERT INTO public.organizations (
    slug, name, tagline,
    pop_token_name, pop_token_symbol,
    txc_property_id, minter_wallet_address,
    status, is_featured,
    created_by
  ) VALUES (
    'cryptopop-usa',
    'CryptoPOP USA',
    'Connect. Experience. Learn.',
    'CryptoPOP', 'POP',
    37, 'TbMELaDs18ANkWuF21iCWt7xYdmWx7GS9S',
    'active', true,
    'b4cda587-c07b-4977-ad7b-2608768bb7e4'
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
)
INSERT INTO public.organization_members (org_id, user_id, role)
SELECT new_org.id, u.user_id, 'owner'::public.org_role
FROM new_org
CROSS JOIN (VALUES
  ('b4cda587-c07b-4977-ad7b-2608768bb7e4'::uuid),
  ('a020da9b-43c2-4629-ba6c-7764ab6bc354'::uuid)
) AS u(user_id)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Backfill org_id on existing rows to the CryptoPOP USA org
WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.events SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.qr_codes SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.pop_awards SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.claims SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.event_signups SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.reward_rules SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.event_quiz_questions SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.blast_campaigns SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;

WITH cpop AS (SELECT id FROM public.organizations WHERE slug = 'cryptopop-usa')
UPDATE public.blast_recipients SET org_id = (SELECT id FROM cpop) WHERE org_id IS NULL;
