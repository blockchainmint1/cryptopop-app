CREATE TABLE public.checkin_award_entitlements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), signup_id uuid NOT NULL REFERENCES public.event_signups(id), source_id text NOT NULL UNIQUE, heads integer NOT NULL, amount numeric NOT NULL, wallet_address text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.checkin_award_entitlements TO authenticated;
GRANT ALL ON public.checkin_award_entitlements TO service_role;
ALTER TABLE public.checkin_award_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read award entitlements" ON public.checkin_award_entitlements FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.record_checkin_entitlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE heads integer; rate numeric:=25; source text; BEGIN
IF OLD.checked_in_at IS NULL AND NEW.checked_in_at IS NOT NULL THEN heads:=1+COALESCE(NEW.guest_count,0); source:=NEW.id::text;
ELSIF OLD.checked_in_at IS NOT NULL AND NEW.guest_count>OLD.guest_count THEN heads:=NEW.guest_count-OLD.guest_count; source:=NEW.id::text||':g'||NEW.guest_count::text;
ELSE RETURN NEW; END IF;
SELECT CASE WHEN enabled THEN pop_amount ELSE 0 END INTO rate FROM public.reward_rules WHERE action_key='event_checkin'; rate:=COALESCE(rate,25);
INSERT INTO public.checkin_award_entitlements(signup_id,source_id,heads,amount,wallet_address) VALUES(NEW.id,source,heads,heads*rate,NEW.external_wallet) ON CONFLICT(source_id) DO NOTHING;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.record_checkin_entitlement() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER checkin_durable_entitlement AFTER UPDATE ON public.event_signups FOR EACH ROW EXECUTE FUNCTION public.record_checkin_entitlement();