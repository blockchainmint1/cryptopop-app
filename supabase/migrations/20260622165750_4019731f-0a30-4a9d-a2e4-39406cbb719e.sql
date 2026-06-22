
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key ON public.events (slug) WHERE slug IS NOT NULL;

UPDATE public.events SET slug = '4th-at-bobbys'
  WHERE name = '4th of July at The Lakehouse' AND slug IS NULL;

ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS event_signups_event_id_idx ON public.event_signups (event_id);

UPDATE public.event_signups
  SET event_id = (SELECT id FROM public.events WHERE slug = '4th-at-bobbys')
  WHERE event_id IS NULL;
