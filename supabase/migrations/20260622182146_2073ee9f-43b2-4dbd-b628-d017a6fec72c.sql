
-- =========================================================================
-- Phase 1B: lock org scoping into the data layer
-- =========================================================================

DO $$ DECLARE cpop uuid := '4774aa4d-ccd8-42eb-aa06-db50dfcbe6eb';
BEGIN
  EXECUTE format('ALTER TABLE public.events             ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.qr_codes           ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.pop_awards         ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.claims             ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.event_signups      ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.reward_rules       ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.event_quiz_questions ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.blast_campaigns    ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
  EXECUTE format('ALTER TABLE public.blast_recipients   ALTER COLUMN org_id SET DEFAULT %L::uuid, ALTER COLUMN org_id SET NOT NULL', cpop);
END $$;

-- Additive RLS policies: org owners/admins get the same access as platform admins.
-- Existing has_role('admin') policies are LEFT IN PLACE so current behavior is unchanged.

-- events
CREATE POLICY "Org admins manage events"
  ON public.events FOR ALL
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- qr_codes
CREATE POLICY "Org admins manage qr_codes"
  ON public.qr_codes FOR ALL
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- pop_awards
CREATE POLICY "Org admins view pop_awards"
  ON public.pop_awards FOR SELECT
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','staff']::public.org_role[]));

CREATE POLICY "Org admins manage pop_awards"
  ON public.pop_awards FOR ALL
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- claims
CREATE POLICY "Org admins view claims"
  ON public.claims FOR SELECT
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','staff']::public.org_role[]));

-- event_signups
CREATE POLICY "Org admins view signups"
  ON public.event_signups FOR SELECT
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','staff']::public.org_role[]));

CREATE POLICY "Org admins update signups"
  ON public.event_signups FOR UPDATE
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','staff']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','staff']::public.org_role[]));

CREATE POLICY "Org admins delete signups"
  ON public.event_signups FOR DELETE
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- reward_rules
CREATE POLICY "Org admins manage reward rules"
  ON public.reward_rules FOR ALL
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- event_quiz_questions
CREATE POLICY "Org admins manage quiz"
  ON public.event_quiz_questions FOR ALL
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- blast_campaigns
CREATE POLICY "Org admins manage blast campaigns"
  ON public.blast_campaigns FOR ALL
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- blast_recipients
CREATE POLICY "Org admins manage blast recipients"
  ON public.blast_recipients FOR ALL
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));
