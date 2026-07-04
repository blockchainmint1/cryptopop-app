-- 1) Track when a retry claims an award row
ALTER TABLE public.pop_awards ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- 2) Atomic claim: only one caller can move an award into 'sending'.
--    Concurrent retries of the same row get zero rows back and skip minting.
--    Stale 'sending' rows (crashed worker) become claimable after 10 minutes.
CREATE OR REPLACE FUNCTION public.claim_pop_award(p_award_id uuid)
RETURNS SETOF public.pop_awards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.pop_awards
     SET status = 'sending',
         error = NULL,
         claimed_at = now()
   WHERE id = p_award_id
     AND (
       status IN ('pending', 'failed')
       OR (status = 'sending' AND claimed_at < now() - interval '10 minutes')
     )
  RETURNING *;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_pop_award(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pop_award(uuid) TO service_role;

-- 3) Single-row mint lock: serializes blockchain broadcasts so two mints
--    never spend the same UTXOs (the source of mempool conflicts).
CREATE TABLE public.pop_mint_lock (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  holder text,
  locked_until timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pop_mint_lock TO service_role;
ALTER TABLE public.pop_mint_lock ENABLE ROW LEVEL SECURITY;
-- No policies: only server-side code (service role) touches this table.
INSERT INTO public.pop_mint_lock (id) VALUES (1);

CREATE OR REPLACE FUNCTION public.acquire_pop_mint_lock(p_holder text, p_ttl_seconds integer DEFAULT 90)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE got boolean;
BEGIN
  UPDATE public.pop_mint_lock
     SET holder = p_holder,
         locked_until = now() + make_interval(secs => p_ttl_seconds),
         updated_at = now()
   WHERE id = 1
     AND (holder IS NULL OR holder = p_holder OR locked_until <= now())
  RETURNING true INTO got;
  RETURN COALESCE(got, false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.acquire_pop_mint_lock(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_pop_mint_lock(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_pop_mint_lock(p_holder text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pop_mint_lock
     SET holder = NULL,
         locked_until = now(),
         updated_at = now()
   WHERE id = 1 AND holder = p_holder;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.release_pop_mint_lock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_pop_mint_lock(text) TO service_role;