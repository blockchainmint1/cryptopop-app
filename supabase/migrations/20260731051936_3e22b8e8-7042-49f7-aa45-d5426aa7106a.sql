CREATE TABLE IF NOT EXISTS public.onramp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  asset text NOT NULL DEFAULT 'tsd',
  amount_usd numeric(12,2) NOT NULL CHECK (amount_usd > 0 AND amount_usd <= 10000),
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'vectorpay',
  plaid_item_id text,
  plaid_account_id text,
  bank_name text,
  account_mask text,
  reference text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  failure_reason text,
  txid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onramp_orders_wallet_idx ON public.onramp_orders (wallet_address, created_at DESC);

GRANT ALL ON public.onramp_orders TO service_role;

ALTER TABLE public.onramp_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onramp_orders_admin_read" ON public.onramp_orders;
CREATE POLICY "onramp_orders_admin_read" ON public.onramp_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_onramp_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onramp_orders_updated_at ON public.onramp_orders;
CREATE TRIGGER onramp_orders_updated_at
  BEFORE UPDATE ON public.onramp_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_onramp_orders();