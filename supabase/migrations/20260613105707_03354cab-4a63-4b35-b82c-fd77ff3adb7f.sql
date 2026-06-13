
-- =============== blast_campaigns ===============
CREATE TABLE public.blast_campaigns (
  campaign_id text PRIMARY KEY,
  subject text NOT NULL,
  preview_text text,
  html text NOT NULL,
  from_name text NOT NULL,
  from_email text NOT NULL,
  reply_to text,
  recipients_raw text NOT NULL,
  total_recipients integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blast_campaigns TO authenticated;
GRANT ALL ON public.blast_campaigns TO service_role;
ALTER TABLE public.blast_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blast campaigns" ON public.blast_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============== blast_recipients ===============
CREATE TABLE public.blast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL REFERENCES public.blast_campaigns(campaign_id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  ses_message_id text,
  error_message text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);
CREATE INDEX idx_blast_recipients_status ON public.blast_recipients(status) WHERE status IN ('pending','sending');
CREATE INDEX idx_blast_recipients_campaign ON public.blast_recipients(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blast_recipients TO authenticated;
GRANT ALL ON public.blast_recipients TO service_role;
ALTER TABLE public.blast_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blast recipients" ON public.blast_recipients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER blast_recipients_set_updated_at
  BEFORE UPDATE ON public.blast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== email_templates ===============
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  preview_text text,
  html text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== pg_cron: drain blast queue every minute ===============
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('cryptopop-blast-drain');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cryptopop-blast-drain',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--61638397-bf4f-48a5-9653-a3fa885ac8d2.lovable.app/api/public/hooks/blast-drain',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwamRodGF6ZWZoZW50ZXFtd3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODg1NTksImV4cCI6MjA5NDE2NDU1OX0.hIBbQdYjH8JtFgZP2Q6coXYDvzIPDSxF3lE_akne0eA"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);
