-- 2604-BUG-101: add nullable posted_at to social_posts
-- Tiles use posted_at ?? created_at for display date.
-- created_at is untouched.

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS posted_at timestamptz DEFAULT NULL;
