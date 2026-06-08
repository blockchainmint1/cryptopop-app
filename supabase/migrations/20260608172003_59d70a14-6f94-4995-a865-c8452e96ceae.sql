CREATE TABLE public.reward_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  pop_amount numeric NOT NULL CHECK (pop_amount >= 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reward_rules TO authenticated;
GRANT ALL ON public.reward_rules TO service_role;

ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reward rules"
ON public.reward_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read enabled rules"
ON public.reward_rules FOR SELECT TO authenticated
USING (enabled = true);

CREATE TRIGGER reward_rules_updated_at
BEFORE UPDATE ON public.reward_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.reward_rules (action_key, label, description, pop_amount) VALUES
  ('event_signup', 'Event signup', 'POP awarded when a new user registers for an event', 10),
  ('scan_checkin', 'QR check-in', 'POP awarded when a user scans an event QR code', 5),
  ('quiz_correct', 'Quiz correct answer', 'POP awarded per correct quiz answer', 2),
  ('referral',     'Referral',           'POP awarded when a referred friend signs up',     15);
