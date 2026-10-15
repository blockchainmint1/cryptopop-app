create table public.hme_sso_nonces (
  nonce text primary key,
  miner_id text not null,
  created_at timestamptz not null default now()
);
alter table public.hme_sso_nonces enable row level security;
revoke all on public.hme_sso_nonces from anon, authenticated;
grant all on public.hme_sso_nonces to service_role;