CREATE TABLE public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  wallet_address text,
  token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
CREATE INDEX push_devices_user_idx ON public.push_devices(user_id);
CREATE INDEX push_devices_wallet_idx ON public.push_devices(wallet_address);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices" ON public.push_devices FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read devices" ON public.push_devices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  audience text not null default 'all',
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;
GRANT ALL ON public.push_campaigns TO service_role;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage campaigns" ON public.push_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));