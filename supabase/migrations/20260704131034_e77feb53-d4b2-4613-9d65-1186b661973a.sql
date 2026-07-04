-- Lock down email queue definer functions from public/anon execution
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;

-- Prevent quiz correct answers from leaking through any future SELECT policy
REVOKE SELECT (correct_index) ON public.event_quiz_questions FROM anon, authenticated;