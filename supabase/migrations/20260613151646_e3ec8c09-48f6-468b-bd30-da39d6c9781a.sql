DROP POLICY IF EXISTS "Users view own claimed wallet" ON public.email_wallets;
REVOKE SELECT ON public.email_wallets FROM authenticated, anon;