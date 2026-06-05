-- Explicit deny policy on wallet_backups so the linter sees a policy.
-- All real access goes through the service role (admin client) which bypasses RLS.
CREATE POLICY "No direct client access" ON public.wallet_backups
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);