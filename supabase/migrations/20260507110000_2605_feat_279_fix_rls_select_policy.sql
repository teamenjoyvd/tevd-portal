-- 2605-FEAT-279 GCR: tighten guide_attachments SELECT policy
-- Previous policy used USING (true) — replace with EXISTS check against guides table.

DROP POLICY IF EXISTS "guide_attachments_select_authenticated" ON public.guide_attachments;

CREATE POLICY "guide_attachments_select_authenticated"
  ON public.guide_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
    )
  );
