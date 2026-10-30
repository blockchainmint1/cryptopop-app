-- Hourly backstop: re-check queued store-payment POP claims, so a reward
-- still arrives when the shopper closes the checkout screen early.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pop-claims-retry') THEN
    PERFORM cron.unschedule('pop-claims-retry');
  END IF;
END
$$;

SELECT cron.schedule(
  'pop-claims-retry',
  '41 * * * *',
  $cmd$SELECT net.http_get(
    url := 'https://app.cryptopop.org/api/public/pop-claims-retry',
    timeout_milliseconds := 60000
  )$cmd$
);

-- Two store payments from 30 Oct 2026 that never asked for POP (paid from the
-- wallet's older address). Inputs verified on-chain as TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m.
INSERT INTO public.pop_claims (txid, wallet_address, payer_addresses, origin)
VALUES
  ('a0977be9ca167d363ed948335c64678325b35f84fce098dbe80136796cd021dc', 'TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m', ARRAY['TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m'], 'qr'),
  ('aacaa61b2fbf7628e93f9e59e58e954a88c0291c828daa1034de1fbda9946579', 'TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m', ARRAY['TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m'], 'qr')
ON CONFLICT (txid) DO NOTHING;