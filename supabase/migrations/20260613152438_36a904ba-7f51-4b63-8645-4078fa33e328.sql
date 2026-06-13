CREATE OR REPLACE FUNCTION public.user_owns_email(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_wallets
    WHERE claimed_by_user_id = _user_id
      AND lower(email) = lower(_email)
  )
$$;

DROP POLICY IF EXISTS "Users view their own POP awards" ON public.pop_awards;
CREATE POLICY "Users view their own POP awards"
ON public.pop_awards
FOR SELECT
TO authenticated
USING (public.user_owns_email(auth.uid(), email));