-- ROLLBACK: DROP FUNCTION IF EXISTS public.get_event_registrations_for_viewer(uuid, uuid);
-- ============================================================
-- [2608-DEV-709] Tiered event registrations visibility
--
-- Part of #702. Implements D5: the calendar Registrations tab stops being
-- admin-only and starts showing each viewer their own slice.
--
--   ADMIN  — every registration on the event
--   CORE   — own INCLUSIVE ltree subtree: downline members' sign-ups plus
--            guests invited by anyone in that subtree
--   MEMBER — own sign-up plus guests from own share links
--   guest  — nothing (early return; the route also 403s them)
--
-- Read-only and STABLE, so there is no internal auth.role() guard: that rule
-- covers DEFINER functions performing cross-user WRITES. The p_viewer spoof
-- surface is closed by the route, which passes the caller's own profile.id
-- resolved server-side from Clerk — never a client-supplied id — and by the
-- grants at the bottom restricting EXECUTE to service_role.
--
-- Additive (a new function), so expand/contract is satisfied: currently
-- deployed code is unaffected. The hazard runs the other way — the new route
-- ships on merge while this waits for the production gate, so approve the
-- gated `Migrate Prod` run promptly or the tab 500s in between.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_event_registrations_for_viewer(
  p_event_id uuid,
  p_viewer   uuid
)
RETURNS TABLE(
  id           uuid,
  registrant   text,
  email        text,
  profile_id   uuid,
  is_member    boolean,
  status       text,
  attended_at  timestamptz,
  cancelled_at timestamptz,
  created_at   timestamptz,
  sharer_name  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
-- Required: the ltree `<@` operator lives in public, and a DEFINER function
-- without a pinned search_path is a hijack surface.
SET search_path = public
AS $$
DECLARE
  v_viewer      public.profiles%ROWTYPE;
  v_anchor      uuid;
  v_anchor_path ltree;
BEGIN
  -- `pr.` alias is load-bearing: `id`, `email`, `status`, `profile_id` and
  -- `created_at` are RETURNS TABLE output parameters, so an unqualified column
  -- of the same name is an ambiguous-reference error in plpgsql.
  SELECT * INTO v_viewer FROM public.profiles pr WHERE pr.id = p_viewer;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Guests see no roster at all. Stated here as well as in the route so it
  -- cannot be routed around.
  IF v_viewer.role = 'guest' THEN
    RETURN;
  END IF;

  -- ADR-016: a co-owner (secondary) profile has no tree_nodes row of its own
  -- and borrows the primary's. Same anchoring as get_payable_beneficiaries
  -- (20260731000000_2607_feat_676_pay_on_behalf.sql:119).
  v_anchor := COALESCE(v_viewer.primary_profile_id, v_viewer.id);
  SELECT tn.path INTO v_anchor_path
  FROM public.tree_nodes tn WHERE tn.profile_id = v_anchor;

  RETURN QUERY
  WITH scope AS (
    -- Always in scope: the viewer themself. For a MEMBER both branches below
    -- are gated off by the role test, so scope collapses to {self} and the
    -- filter yields exactly "own sign-up + own share-link guests".
    SELECT p_viewer AS pid

    UNION

    -- INCLUSIVE subtree (no `tn.path <> v_anchor_path` exclusion — a CORE is
    -- part of their own leg here, unlike the pay-on-behalf picker). Predicate
    -- shape matches get_trip_team_attendees (baseline.sql:584-597); both sides
    -- anchored on COALESCE(primary_profile_id, id) per ADR-016 so a downline's
    -- co-owner is reachable transitively.
    SELECT p.id
    FROM public.profiles p
    JOIN public.tree_nodes tn ON tn.profile_id = COALESCE(p.primary_profile_id, p.id)
    WHERE v_viewer.role IN ('core', 'admin')
      AND v_anchor_path IS NOT NULL
      AND tn.path <@ v_anchor_path

    UNION

    -- ABO-less members: upsert_tree_node plants them as their own placeholder
    -- root `p_<uuid>` (baseline.sql:407-419), so no `<@` query can ever reach
    -- them. Reach them through profiles.upline_abo_number — written only by
    -- approve_member_verification and the LOS import — and deliberately NOT
    -- abo_verification_requests.claimed_upline_abo, which is self-declared and
    -- unapproved and would let anyone claiming your ABO into your roster.
    SELECT p.id
    FROM public.profiles p
    JOIN public.profiles up ON up.abo_number = p.upline_abo_number
    JOIN public.tree_nodes tn ON tn.profile_id = COALESCE(up.primary_profile_id, up.id)
    WHERE v_viewer.role IN ('core', 'admin')
      AND v_anchor_path IS NOT NULL
      AND p.abo_number IS NULL
      AND p.upline_abo_number IS NOT NULL
      AND p.role <> 'guest'
      AND tn.path <@ v_anchor_path
  )
  SELECT
    gr.id,
    gr.name,
    -- No COALESCE back to a placeholder: guest_registrations_guest_xor_member_chk
    -- (20260809000000...:53-57) already forces email IS NULL on member rows, so
    -- "members have no email column shown" is enforced by the schema, not here.
    gr.email,
    gr.profile_id,
    (gr.profile_id IS NOT NULL) AS is_member,
    -- Same precedence the deleted admin route applied in TypeScript
    -- (attended > cancelled > stored status).
    CASE
      WHEN gr.attended_at  IS NOT NULL THEN 'attended'
      WHEN gr.cancelled_at IS NOT NULL THEN 'cancelled'
      ELSE gr.status::text
    END AS status,
    gr.attended_at,
    gr.cancelled_at,
    gr.created_at,
    NULLIF(TRIM(COALESCE(sp.first_name, '') || ' ' || COALESCE(sp.last_name, '')), '') AS sharer_name
  FROM public.guest_registrations gr
  LEFT JOIN public.event_share_links sl ON sl.id = gr.share_link_id
  LEFT JOIN public.profiles          sp ON sp.id = sl.profile_id
  WHERE gr.event_id = p_event_id
    AND (
         v_viewer.role = 'admin'
         -- member sign-ups inside the scope
      OR gr.profile_id IN (SELECT s.pid FROM scope s)
         -- guests invited by someone inside the scope
      OR sl.profile_id IN (SELECT s.pid FROM scope s)
    )
  ORDER BY gr.created_at DESC;

  -- NOT AN ACCIDENT — unattributed guests are admin-only for free: a direct
  -- guest row has gr.profile_id IS NULL and (no share link ->) sl.profile_id
  -- IS NULL, so both IN predicates evaluate to NULL rather than false,
  -- `false OR NULL OR NULL` is NULL, and a NULL WHERE is not a match. Do not
  -- "fix" this into IS NOT DISTINCT FROM or add COALESCE(..., false) around
  -- it expecting no change — the admin-only tiering is what falls out.
END;
$$;

COMMENT ON FUNCTION public.get_event_registrations_for_viewer(uuid, uuid) IS
  'The single definition of which registrations on an event p_viewer may see: admin sees all, core sees its inclusive LOS subtree (member sign-ups plus guests those members invited), member sees own sign-up plus own share-link guests, guest sees nothing. Unattributed guests (share_link_id IS NULL) are admin-only. p_viewer must be resolved server-side, never client-supplied.';

-- Grants per 20260707120400_tighten_definer_grants.sql: no anon/authenticated
-- path exists; every caller goes through the service client.
REVOKE EXECUTE ON FUNCTION public.get_event_registrations_for_viewer(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_event_registrations_for_viewer(uuid, uuid) TO service_role;
