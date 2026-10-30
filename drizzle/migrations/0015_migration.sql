CREATE TABLE public.pop_claims (
  txid text PRIMARY KEY,
  wallet_address text NOT NULL,
  payer_addresses text[] NOT NULL,
  origin text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  invoice_id text,
  pop integer,
  attempts integer NOT NULL DEFAULT 0,
  next_try_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pop_claims_due ON public.pop_claims (status, next_try_at);
ALTER TABLE public.pop_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pop_claims FROM anon, authenticated;
GRANT ALL ON public.pop_claims TO service_role;