CREATE TABLE public.reward_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nectar_store_id text NOT NULL UNIQUE,
  store_name text NOT NULL,
  logo_url text,
  market_slug text,
  rate_bps integer NOT NULL DEFAULT 100 CHECK (rate_bps >= 0 AND rate_bps <= 2000),
  issue_type text NOT NULL DEFAULT 'store' CHECK (issue_type IN ('store','community')),
  enabled boolean NOT NULL DEFAULT true,
  community_status text NOT NULL DEFAULT 'none' CHECK (community_status IN ('none','pending','approved','declined','paused')),
  community_credit_limit numeric NOT NULL DEFAULT 0 CHECK (community_credit_limit >= 0),
  community_balance numeric NOT NULL DEFAULT 0,
  omni_property_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.reward_programs TO authenticated;
GRANT ALL ON public.reward_programs TO service_role;
ALTER TABLE public.reward_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read reward programs" ON public.reward_programs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update reward programs" ON public.reward_programs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER reward_programs_updated BEFORE UPDATE ON public.reward_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.reward_programs(id),
  kind text NOT NULL CHECK (kind IN ('store','community')),
  market_slug text,
  wallet_address text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL CHECK (reason IN ('earn','redeem')),
  invoice_id text NOT NULL,
  txid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, reason)
);
CREATE INDEX reward_ledger_wallet_idx ON public.reward_ledger (wallet_address);
GRANT SELECT ON public.reward_ledger TO authenticated;
GRANT ALL ON public.reward_ledger TO service_role;
ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read reward ledger" ON public.reward_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));