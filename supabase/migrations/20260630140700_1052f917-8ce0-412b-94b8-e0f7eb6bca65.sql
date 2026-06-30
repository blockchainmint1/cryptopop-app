
-- Allow anonymous visitors to browse public events (column-level security already restricts lat/lng/radius_m)
CREATE POLICY "Anonymous users can view public events"
  ON public.events
  FOR SELECT
  TO anon
  USING (visibility = 'public'::event_visibility);

-- Allow authenticated users to read their own claimed email_wallets record
CREATE POLICY "Users can view their own email wallet"
  ON public.email_wallets
  FOR SELECT
  TO authenticated
  USING (claimed_by_user_id = auth.uid());
