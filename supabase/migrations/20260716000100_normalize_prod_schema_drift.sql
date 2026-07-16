-- #570: normalize the prod/DEV schema drift found by the 2026-07-16 read-only
-- audit (full public-schema inventory diff, prod vs DEV: 23 mismatched items
-- out of ~750; all MCP-era). Every statement is idempotent and safe on prod,
-- on DEV, and on a fresh replay. Verified before writing:
--   * prod has 0 duplicate profiles.primary_profile_id values (unique-safe)
--   * prod has 1 pinned social post, DEV has 0 (unique-pinned-safe)
-- ROLLBACK: DROP TRIGGER trg_guard_abo_number_null ON profiles; DROP FUNCTION
--   fn_guard_abo_number_null(); DROP INDEX tree_nodes_path_btree_idx,
--   notifications_profile_id_idx, notifications_is_read_idx,
--   idx_spouse_link_requests_claimed_primary, social_posts_single_pinned,
--   profiles_primary_profile_id_key; recreate idx_social_posts_pinned (see
--   baseline); ALTER TABLE settings DROP COLUMN created_at, updated_at;
--   policy/constraint changes: restore from pre-migration pg_dump only.

-- 1. settings timestamps: prod's table pre-existed 20260514000200's
--    CREATE IF NOT EXISTS (MCP drift), so it never got these columns.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. abo_number NULL guard: existed only on prod (MCP-applied, referenced by
--    20260707120400 but created by no file). Definition copied verbatim from
--    prod catalogs 2026-07-16. Adds the guard to DEV/fresh replays.
CREATE OR REPLACE FUNCTION public.fn_guard_abo_number_null()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Invariant: a primary (non-co-owner) profile with role member or core
  -- MUST have a real abo_number. NULL is illegal for these combinations.
  -- Exempt: admin (ops role, no LOS identity), guest, co-owners (primary_profile_id IS NOT NULL).
  IF NEW.abo_number IS NULL
     AND NEW.role IN ('member', 'core')
     AND NEW.primary_profile_id IS NULL
  THEN
    RAISE EXCEPTION
      'abo_number cannot be NULL for a primary profile with role %. '
      'Profile: %. Caller: %.',
      NEW.role,
      NEW.id,
      COALESCE(current_setting('app.current_user_id', true), 'service_role')
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_abo_number_null ON public.profiles;
CREATE TRIGGER trg_guard_abo_number_null
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_abo_number_null();

-- 3. spouse_link_requests policies: prod ran an older MCP 2-policy set.
--    Normalize to the 20260508000200 file-state (Pattern A helpers only).
DROP POLICY IF EXISTS "Requester can view own request" ON public.spouse_link_requests;
DROP POLICY IF EXISTS "Admin can do all" ON public.spouse_link_requests;

DROP POLICY IF EXISTS "spouse_link_requests_select_own" ON public.spouse_link_requests;
CREATE POLICY "spouse_link_requests_select_own"
  ON public.spouse_link_requests FOR SELECT
  USING (requester_id = get_my_profile_id());

DROP POLICY IF EXISTS "spouse_link_requests_insert_own" ON public.spouse_link_requests;
CREATE POLICY "spouse_link_requests_insert_own"
  ON public.spouse_link_requests FOR INSERT
  WITH CHECK (requester_id = get_my_profile_id());

DROP POLICY IF EXISTS "spouse_link_requests_delete_own_pending" ON public.spouse_link_requests;
CREATE POLICY "spouse_link_requests_delete_own_pending"
  ON public.spouse_link_requests FOR DELETE
  USING (requester_id = get_my_profile_id() AND status = 'pending');

DROP POLICY IF EXISTS "spouse_link_requests_admin_all" ON public.spouse_link_requests;
CREATE POLICY "spouse_link_requests_admin_all"
  ON public.spouse_link_requests FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 4. One-active-request-per-requester: files enforce it as constraint
--    uq_spouse_link_requester; prod enforces it via a stray unique index.
--    Adopt the existing index as the constraint where possible.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_spouse_link_requester'
      AND conrelid = 'public.spouse_link_requests'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'spouse_link_requests_requester_unique'
    ) THEN
      ALTER TABLE public.spouse_link_requests
        ADD CONSTRAINT uq_spouse_link_requester UNIQUE
        USING INDEX spouse_link_requests_requester_unique;
    ELSE
      ALTER TABLE public.spouse_link_requests
        ADD CONSTRAINT uq_spouse_link_requester UNIQUE (requester_id);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spouse_link_requests_requester
  ON public.spouse_link_requests (requester_id);

-- 5. Retro-fit prod-only perf indexes (MCP-applied, no file; useful — keep).
CREATE INDEX IF NOT EXISTS tree_nodes_path_btree_idx
  ON public.tree_nodes USING btree (path);
CREATE INDEX IF NOT EXISTS notifications_profile_id_idx
  ON public.member_notifications USING btree (profile_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx
  ON public.member_notifications USING btree (profile_id, is_read)
  WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_spouse_link_requests_claimed_primary
  ON public.spouse_link_requests USING btree (claimed_primary_id);

-- 6. Single-pinned invariant: adopt prod's stronger UNIQUE partial index and
--    drop the baseline's redundant non-unique twin.
CREATE UNIQUE INDEX IF NOT EXISTS social_posts_single_pinned
  ON public.social_posts USING btree (is_pinned)
  WHERE (is_pinned = true);
DROP INDEX IF EXISTS public.idx_social_posts_pinned;

-- 7. Partnership uniqueness (20260508000400) that prod never received.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_primary_profile_id_key
  ON public.profiles USING btree (primary_profile_id)
  WHERE (primary_profile_id IS NOT NULL);

-- 8. Indexes dropped by 20260504000002 that prod still carries (it never
--    received those drops).
DROP INDEX IF EXISTS public.guest_registrations_event_id_idx;
DROP INDEX IF EXISTS public.idx_event_share_links_profile;
