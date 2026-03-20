-- ISS-0157: social_posts — partial unique index + atomic pin RPC
-- ISS-0171 incorporated: race condition prevention at DB level
-- Table, RLS, and policies exist from 20260320211037_create_social_posts

-- Enforce single pinned post at DB level
CREATE UNIQUE INDEX social_posts_single_pinned
  ON social_posts (is_pinned)
  WHERE is_pinned = true;

-- Atomic pin-swap: unpin all others, pin target — called via supabase.rpc('pin_social_post', { p_id })
CREATE OR REPLACE FUNCTION pin_social_post(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE social_posts SET is_pinned = false WHERE is_pinned = true AND id != p_id;
  UPDATE social_posts SET is_pinned = true WHERE id = p_id;
END;
$$;
