COMMENT ON TABLE public.wallet_backups IS 'DEPRECATED: custodial key export retired; retain encrypted legacy records for controlled reconciliation only';
COMMENT ON TABLE public.email_wallets IS 'DEPRECATED: no new custodial wallets or awards; historical addresses retained for reconciliation';
REVOKE ALL ON public.wallet_backups FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS hme_sso_nonce_expiry_idx ON public.hme_sso_nonces(created_at);

CREATE OR REPLACE FUNCTION public.enforce_reward_ledger_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.reward_programs; have numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.wallet_address, 0));
  SELECT * INTO p FROM public.reward_programs WHERE id = NEW.program_id FOR UPDATE;
  IF NOT FOUND OR NOT p.enabled THEN RAISE EXCEPTION 'Rewards program unavailable'; END IF;
  IF NEW.reason = 'earn' THEN
    IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Invalid reward amount'; END IF;
    IF NEW.kind = 'community' AND (p.community_status <> 'approved' OR p.market_slug IS NULL OR p.community_balance - NEW.amount < -p.community_credit_limit) THEN
      NEW.kind := 'store'; NEW.market_slug := NULL;
    END IF;
  ELSE
    IF NEW.amount >= 0 THEN RAISE EXCEPTION 'Invalid redemption amount'; END IF;
    IF NEW.kind = 'community' AND (p.community_status <> 'approved' OR p.market_slug IS NULL) THEN RAISE EXCEPTION 'Community rewards unavailable'; END IF;
    SELECT COALESCE(sum(amount),0) INTO have FROM public.reward_ledger
      WHERE wallet_address = NEW.wallet_address AND kind = NEW.kind AND
      ((NEW.kind = 'store' AND program_id = NEW.program_id) OR (NEW.kind = 'community' AND market_slug = p.market_slug));
    IF have + NEW.amount < 0 THEN RAISE EXCEPTION 'Rewards must cover the whole bill'; END IF;
  END IF;
  IF NEW.kind = 'community' THEN
    NEW.market_slug := p.market_slug;
    UPDATE public.reward_programs SET community_balance = community_balance - NEW.amount WHERE id = p.id;
  ELSE NEW.market_slug := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_reward_ledger_balance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reward_ledger_atomic_balance BEFORE INSERT ON public.reward_ledger FOR EACH ROW EXECUTE FUNCTION public.enforce_reward_ledger_balance();
CREATE OR REPLACE FUNCTION public.restore_reward_ledger_credit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.wallet_address,0));
  IF OLD.kind = 'community' THEN
    UPDATE public.reward_programs SET community_balance = community_balance + OLD.amount WHERE id = OLD.program_id;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.restore_reward_ledger_credit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reward_ledger_rollback_credit AFTER DELETE ON public.reward_ledger FOR EACH ROW EXECUTE FUNCTION public.restore_reward_ledger_credit();

CREATE OR REPLACE FUNCTION public.consume_qr_code(p_code_id uuid, p_user_id uuid, p_lat double precision, p_lng double precision) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.qr_codes; redemption_id uuid;
BEGIN
  SELECT * INTO c FROM public.qr_codes WHERE id = p_code_id FOR UPDATE;
  IF NOT FOUND OR NOT c.active OR c.expires_at <= now() THEN RAISE EXCEPTION 'Code unavailable'; END IF;
  IF c.single_use AND c.use_count >= 1 THEN RAISE EXCEPTION 'This code has already been claimed'; END IF;
  INSERT INTO public.qr_redemptions(code_id,user_id,pop_amount,status,lat,lng)
    VALUES(c.id,p_user_id,c.pop_reward,'pending',p_lat,p_lng) RETURNING id INTO redemption_id;
  UPDATE public.qr_codes SET use_count = use_count + 1 WHERE id = c.id;
  RETURN redemption_id;
END $$;
REVOKE ALL ON FUNCTION public.consume_qr_code(uuid,uuid,double precision,double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_qr_code(uuid,uuid,double precision,double precision) TO service_role;

CREATE TABLE public.checkin_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), signup_id uuid NOT NULL REFERENCES public.event_signups(id),
 actor_id uuid NOT NULL, previous_guests integer NOT NULL, new_guests integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.checkin_adjustments TO authenticated;
GRANT ALL ON public.checkin_adjustments TO service_role;
ALTER TABLE public.checkin_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read checkin adjustments" ON public.checkin_adjustments FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.audit_checkin_guests() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.guest_count < 0 OR NEW.guest_count > 20 THEN RAISE EXCEPTION 'At most 20 guests per pass'; END IF;
 IF OLD.checked_in_at IS NOT NULL AND NEW.guest_count IS DISTINCT FROM OLD.guest_count THEN
   IF NEW.checked_in_by IS NULL OR NOT public.has_role(NEW.checked_in_by,'admin') THEN RAISE EXCEPTION 'Only an administrator can adjust checked-in guests'; END IF;
   INSERT INTO public.checkin_adjustments(signup_id,actor_id,previous_guests,new_guests) VALUES(NEW.id,NEW.checked_in_by,OLD.guest_count,NEW.guest_count);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_checkin_guests() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER checkin_guest_ceiling BEFORE UPDATE ON public.event_signups FOR EACH ROW EXECUTE FUNCTION public.audit_checkin_guests();