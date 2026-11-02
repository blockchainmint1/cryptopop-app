ALTER TABLE public.nfc_card_payments ADD COLUMN IF NOT EXISTS give_recipient_address text, ADD COLUMN IF NOT EXISTS give_recipient_name text;
