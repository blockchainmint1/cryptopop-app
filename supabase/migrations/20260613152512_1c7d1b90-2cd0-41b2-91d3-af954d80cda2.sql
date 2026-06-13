REVOKE EXECUTE ON FUNCTION public.user_owns_email(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_email(uuid, text) TO authenticated;