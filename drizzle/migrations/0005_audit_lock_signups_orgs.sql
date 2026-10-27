DROP POLICY IF EXISTS "Anyone can submit a signup" ON public.event_signups;
REVOKE INSERT ON public.event_signups FROM anon, authenticated;
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
REVOKE INSERT ON public.organizations FROM anon, authenticated;