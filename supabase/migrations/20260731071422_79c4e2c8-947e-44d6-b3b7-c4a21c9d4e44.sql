DROP POLICY IF EXISTS "Authenticated read enabled rules" ON public.reward_rules;
CREATE POLICY "Members read own org enabled rules"
ON public.reward_rules
FOR SELECT
TO authenticated
USING (enabled = true AND public.is_org_member(auth.uid(), org_id));