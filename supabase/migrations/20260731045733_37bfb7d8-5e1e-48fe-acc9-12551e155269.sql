create or replace function public.pop_address_rank(_address text)
returns table(rank bigint, total bigint, balance numeric)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select wallet_address, sum(amount)::numeric as bal
    from public.pop_awards
    where status in ('sent','pending') and wallet_address is not null
    group by wallet_address
  ), ranked as (
    select wallet_address, bal,
           rank() over (order by bal desc) as r,
           count(*) over () as c
    from totals
  )
  select r, c, bal from ranked where lower(wallet_address) = lower(_address) limit 1;
$$;

revoke all on function public.pop_address_rank(text) from public;
revoke all on function public.pop_address_rank(text) from anon;
revoke all on function public.pop_address_rank(text) from authenticated;
grant execute on function public.pop_address_rank(text) to service_role;