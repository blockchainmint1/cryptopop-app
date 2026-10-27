CREATE OR REPLACE FUNCTION public.nfc_reserve_payment(p_card uuid, p_invoice text, p_merchant text, p_usd numeric, p_tsd numeric, p_recipient text)
RETURNS TABLE(payment_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c nfc_cards; spent numeric; st text; pid uuid;
BEGIN
  SELECT * INTO c FROM nfc_cards WHERE id = p_card FOR UPDATE;
  IF NOT FOUND OR NOT c.enabled OR c.killed_at IS NOT NULL THEN RAISE EXCEPTION 'Card is off'; END IF;
  SELECT COALESCE(sum(p.amount_usd),0) INTO spent FROM nfc_card_payments p
    WHERE p.card_id = p_card AND p.created_at > now() - interval '24 hours' AND p.status IN ('sending','sent');
  IF p_usd > c.per_tap_usd OR spent + p_usd > c.daily_usd THEN st := 'approval_required'; ELSE st := 'sending'; END IF;
  INSERT INTO nfc_card_payments AS np (card_id, invoice_id, merchant_name, amount_usd, tsd_amount, recipient, status)
    VALUES (p_card, p_invoice, p_merchant, p_usd, p_tsd, p_recipient, st) RETURNING np.id INTO pid;
  RETURN QUERY SELECT pid, st;
END $$;
REVOKE ALL ON FUNCTION public.nfc_reserve_payment(uuid,text,text,numeric,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_reserve_payment(uuid,text,text,numeric,numeric,text) TO service_role;