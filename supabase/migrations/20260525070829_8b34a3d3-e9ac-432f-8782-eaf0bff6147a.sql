
-- 1. Restrict quiz answer keys: drop authenticated read (only admins manage)
DROP POLICY IF EXISTS "Authenticated can view quiz" ON public.event_quiz_questions;

-- 2. pop_balance_mirror: scope to owner only
DROP POLICY IF EXISTS "Balances viewable by everyone" ON public.pop_balance_mirror;
CREATE POLICY "Users view own balance"
ON public.pop_balance_mirror FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. profiles: restrict reads to authenticated users (hide wallet from anon)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 4. event_rsvps: explicit admin DELETE/UPDATE policies
CREATE POLICY "Admins delete RSVPs"
ON public.event_rsvps FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update RSVPs"
ON public.event_rsvps FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Fix mutable search_path on set_updated_at
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 6. Revoke broad EXECUTE on SECURITY DEFINER functions; RLS-internal calls still work
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.event_signups_apply_defaults() FROM anon, authenticated, public;

-- 7. Storage: remove broad listing on avatars bucket; public URLs still work for known paths
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;
CREATE POLICY "Users read own avatar files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
