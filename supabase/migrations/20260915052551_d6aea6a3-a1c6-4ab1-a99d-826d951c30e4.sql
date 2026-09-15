CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  version TEXT NOT NULL,
  build_number BIGINT,
  ipfs_cid TEXT,
  download_url TEXT,
  notes TEXT,
  mandatory BOOLEAN NOT NULL DEFAULT false,
  released_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (platform, version)
);

GRANT SELECT ON public.app_releases TO anon;
GRANT SELECT ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Release info is public" ON public.app_releases;
CREATE POLICY "Release info is public" ON public.app_releases FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS app_releases_platform_released_at_idx ON public.app_releases (platform, released_at DESC);

INSERT INTO public.app_releases (platform, version, build_number, ipfs_cid, download_url, notes, released_at)
VALUES (
  'android',
  '1.0.5',
  1005,
  NULL,
  'https://app.cryptopop.org/__l5e/assets-v1/efef1d8f-38ae-4b02-afe0-bb30c48647df/popwallet-1.0.5-release.apk',
  'POP Wallet Android release.',
  now()
)
ON CONFLICT (platform, version) DO UPDATE SET
  download_url = EXCLUDED.download_url,
  notes = EXCLUDED.notes,
  released_at = EXCLUDED.released_at;