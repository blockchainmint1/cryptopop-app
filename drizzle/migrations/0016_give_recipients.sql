CREATE TABLE public.give_recipients (
  owner_address text PRIMARY KEY,
  charity_code text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.give_recipients TO service_role;
ALTER TABLE public.give_recipients ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.give_recipients IS 'Give recipient chosen by a wallet (keyed by its card owner address). Written only by signed server actions; card-tap splits happen only when a row exists.';