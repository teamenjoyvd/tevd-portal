-- 2605-FEAT-279: guide_attachments table + RLS

CREATE TABLE IF NOT EXISTS public.guide_attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id    uuid        NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  file_url    text        NOT NULL,
  file_name   text        NOT NULL,
  label       text,
  file_type   text        NOT NULL CHECK (file_type IN ('pdf', 'image', 'other')),
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_attachments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read attachments for guides they have access to
CREATE POLICY "guide_attachments_select_authenticated"
  ON public.guide_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
    )
  );

-- Only admins can insert
CREATE POLICY "guide_attachments_insert_admin"
  ON public.guide_attachments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins can update
CREATE POLICY "guide_attachments_update_admin"
  ON public.guide_attachments FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can delete
CREATE POLICY "guide_attachments_delete_admin"
  ON public.guide_attachments FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS guide_attachments_guide_id_sort_order_idx
  ON public.guide_attachments (guide_id, sort_order);
