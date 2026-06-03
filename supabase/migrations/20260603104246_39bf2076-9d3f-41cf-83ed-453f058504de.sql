TRUNCATE TABLE
  public.pop_awards,
  public.email_wallets,
  public.claims,
  public.referrals,
  public.pop_balance_mirror,
  public.event_signups,
  public.event_rsvps,
  public.wallet_backups,
  public.email_send_log,
  public.email_unsubscribe_tokens,
  public.suppressed_emails
RESTART IDENTITY;

-- Delete non-admin users only (preserves event ownership + admin logins)
DELETE FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');