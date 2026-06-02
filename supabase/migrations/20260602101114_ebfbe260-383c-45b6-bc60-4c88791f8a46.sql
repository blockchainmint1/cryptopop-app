CREATE TABLE public.wallet_backups (
  user_id UUID NOT NULL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  version SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Intentionally NO grants to anon/authenticated.
-- Only service_role (server functions via supabaseAdmin) may touch this table.
GRANT ALL ON public.wallet_backups TO service_role;

ALTER TABLE public.wallet_backups ENABLE ROW LEVEL SECURITY;

-- No policies = no client access. Service role bypasses RLS.

CREATE TRIGGER wallet_backups_set_updated_at
BEFORE UPDATE ON public.wallet_backups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();