CREATE TABLE public.wallet_vault_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  blob jsonb NOT NULL,
  origin text NOT NULL DEFAULT 'generated',
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_vault_backups TO authenticated;
GRANT ALL ON public.wallet_vault_backups TO service_role;

ALTER TABLE public.wallet_vault_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own vault backup"
  ON public.wallet_vault_backups FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER wallet_vault_backups_set_updated_at
  BEFORE UPDATE ON public.wallet_vault_backups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();