CREATE TABLE public.nfc_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address text NOT NULL,
  uid_hash text NOT NULL UNIQUE,
  uid_hint text NOT NULL,
  label text NOT NULL,
  pocket_index integer NOT NULL CHECK (pocket_index >= 0 AND pocket_index < 1000),
  pocket_address text NOT NULL,
  return_address text NOT NULL,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  pin_fails integer NOT NULL DEFAULT 0,
  per_tap_usd numeric NOT NULL DEFAULT 100,
  daily_usd numeric NOT NULL DEFAULT 500,
  enabled boolean NOT NULL DEFAULT true,
  killed_at timestamptz,
  tg_code text,
  tg_chat_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_address, pocket_index)
);
CREATE TABLE public.nfc_card_keys (
  card_id uuid PRIMARY KEY REFERENCES public.nfc_cards(id) ON DELETE CASCADE,
  enc_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nfc_card_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.nfc_cards(id),
  invoice_id text NOT NULL,
  merchant_name text,
  amount_usd numeric NOT NULL,
  tsd_amount numeric NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL,
  reason text,
  txid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX nfc_card_payments_one_live_per_invoice ON public.nfc_card_payments(invoice_id)
  WHERE status IN ('approval_required','sending','sent');
CREATE INDEX nfc_card_payments_card_time ON public.nfc_card_payments(card_id, created_at DESC);
CREATE INDEX nfc_cards_owner ON public.nfc_cards(owner_address);

GRANT ALL ON public.nfc_cards TO service_role;
GRANT ALL ON public.nfc_card_keys TO service_role;
GRANT ALL ON public.nfc_card_payments TO service_role;
ALTER TABLE public.nfc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_card_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_card_payments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER nfc_cards_updated BEFORE UPDATE ON public.nfc_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER nfc_card_payments_updated BEFORE UPDATE ON public.nfc_card_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic PIN check: counts failures and locks after 5.
CREATE OR REPLACE FUNCTION public.nfc_record_pin(p_card uuid, p_ok boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF p_ok THEN UPDATE nfc_cards SET pin_fails = 0 WHERE id = p_card RETURNING pin_fails INTO n;
  ELSE UPDATE nfc_cards SET pin_fails = pin_fails + 1 WHERE id = p_card RETURNING pin_fails INTO n;
  END IF;
  RETURN n;
END $$;

-- Atomic reservation: decides instant vs approval under a per-card lock.
CREATE OR REPLACE FUNCTION public.nfc_reserve_payment(p_card uuid, p_invoice text, p_merchant text, p_usd numeric, p_tsd numeric, p_recipient text)
RETURNS TABLE(payment_id uuid, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c nfc_cards; spent numeric; st text; pid uuid;
BEGIN
  SELECT * INTO c FROM nfc_cards WHERE id = p_card FOR UPDATE;
  IF NOT FOUND OR NOT c.enabled OR c.killed_at IS NOT NULL THEN RAISE EXCEPTION 'Card is off'; END IF;
  SELECT COALESCE(sum(amount_usd),0) INTO spent FROM nfc_card_payments
    WHERE card_id = p_card AND created_at > now() - interval '24 hours' AND status IN ('sending','sent');
  IF p_usd > c.per_tap_usd OR spent + p_usd > c.daily_usd THEN st := 'approval_required'; ELSE st := 'sending'; END IF;
  INSERT INTO nfc_card_payments(card_id, invoice_id, merchant_name, amount_usd, tsd_amount, recipient, status)
    VALUES (p_card, p_invoice, p_merchant, p_usd, p_tsd, p_recipient, st) RETURNING id INTO pid;
  RETURN QUERY SELECT pid, st;
END $$;

-- Claim an approved payment exactly once.
CREATE OR REPLACE FUNCTION public.nfc_claim_approval(p_payment uuid, p_chat text, p_approve boolean)
RETURNS SETOF nfc_card_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY UPDATE nfc_card_payments p
     SET status = CASE WHEN p_approve THEN 'sending' ELSE 'declined' END,
         reason = CASE WHEN p_approve THEN NULL ELSE 'Owner declined' END
    FROM nfc_cards c
   WHERE p.id = p_payment AND c.id = p.card_id AND c.tg_chat_id = p_chat
     AND p.status = 'approval_required' AND p.created_at > now() - interval '15 minutes'
     AND c.enabled AND c.killed_at IS NULL
  RETURNING p.*;
END $$;

REVOKE ALL ON FUNCTION public.nfc_record_pin(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfc_reserve_payment(uuid, text, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfc_claim_approval(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_record_pin(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.nfc_reserve_payment(uuid, text, text, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.nfc_claim_approval(uuid, text, boolean) TO service_role;