CREATE TABLE public.social_posts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text        NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  post_url       text        NOT NULL,
  caption        text        NULL,
  thumbnail_url  text        NULL,
  is_visible     boolean     NOT NULL DEFAULT true,
  is_pinned      boolean     NOT NULL DEFAULT false,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users
CREATE POLICY "social_posts_select_authenticated"
  ON public.social_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: admin only
CREATE POLICY "social_posts_insert_admin"
  ON public.social_posts
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- UPDATE: admin only
CREATE POLICY "social_posts_update_admin"
  ON public.social_posts
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- DELETE: admin only
CREATE POLICY "social_posts_delete_admin"
  ON public.social_posts
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');
