
-- email_wallets: one row per email, custodial wallet until claimed
CREATE TABLE public.email_wallets (
  email TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  derivation_index BIGINT NOT NULL,
  claimed_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);

GRANT SELECT ON public.email_wallets TO authenticated;
GRANT ALL ON public.email_wallets TO service_role;

ALTER TABLE public.email_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own claimed wallet"
ON public.email_wallets FOR SELECT TO authenticated
USING (auth.uid() = claimed_by_user_id);

-- pop_awards: append-only ledger of on-chain POP grants
CREATE TABLE public.pop_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  tx_hash TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (source, source_id)
);

CREATE INDEX idx_pop_awards_email ON public.pop_awards (email);
CREATE INDEX idx_pop_awards_wallet ON public.pop_awards (wallet_address);

GRANT SELECT ON public.pop_awards TO authenticated;
GRANT ALL ON public.pop_awards TO service_role;

ALTER TABLE public.pop_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own POP awards"
ON public.pop_awards FOR SELECT TO authenticated
USING (
  email IN (
    SELECT lower(ew.email) FROM public.email_wallets ew
    WHERE ew.claimed_by_user_id = auth.uid()
  )
);

-- Extend handle_new_user to auto-claim any wallet for this email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Auto-claim any email_wallet created for this email pre-signup
  IF NEW.email IS NOT NULL THEN
    UPDATE public.email_wallets
    SET claimed_by_user_id = NEW.id,
        claimed_at = now()
    WHERE email = lower(NEW.email)
      AND claimed_by_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;
