-- =============================================================================
-- Migration: 20260513_003_profiles_field_audit.sql
-- Purpose:
--   A) Field-level forensic audit table + trigger for profiles
--   B) Secondary profile invariant enforcement in approve_member_verification
--   C) One-time cleanup of orphaned tree_nodes row for secondary cb703519
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A1: profiles_audit table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles_audit (
  id                       uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id               uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_at               timestamptz NOT NULL DEFAULT now(),
  changed_by               text,
  old_abo_number           text,
  new_abo_number           text,
  old_upline_abo_number    text,
  new_upline_abo_number    text,
  old_primary_profile_id   uuid,
  new_primary_profile_id   uuid,
  old_role                 text,
  new_role                 text
);

-- ---------------------------------------------------------------------------
-- A2: Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS profiles_audit_profile_id_idx
  ON public.profiles_audit (profile_id);

CREATE INDEX IF NOT EXISTS profiles_audit_changed_at_idx
  ON public.profiles_audit (changed_at DESC);

-- ---------------------------------------------------------------------------
-- A3: RLS — SELECT admin-only; INSERT handled by trigger (service-role context
--     bypasses RLS per ADR-002; no INSERT policy needed for authenticated users)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_audit_admin_select"
  ON public.profiles_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- A4: Trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_profiles_field_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Noop if none of the 4 tracked fields changed
  IF (
    NEW.abo_number           IS NOT DISTINCT FROM OLD.abo_number           AND
    NEW.upline_abo_number    IS NOT DISTINCT FROM OLD.upline_abo_number    AND
    NEW.primary_profile_id   IS NOT DISTINCT FROM OLD.primary_profile_id   AND
    NEW.role                 IS NOT DISTINCT FROM OLD.role
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles_audit (
    profile_id,
    changed_by,
    old_abo_number,           new_abo_number,
    old_upline_abo_number,    new_upline_abo_number,
    old_primary_profile_id,   new_primary_profile_id,
    old_role,                 new_role
  ) VALUES (
    NEW.id,
    COALESCE(current_setting('app.current_user_id', true), 'service_role'),
    OLD.abo_number,           NEW.abo_number,
    OLD.upline_abo_number,    NEW.upline_abo_number,
    OLD.primary_profile_id,   NEW.primary_profile_id,
    OLD.role::text,           NEW.role::text
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- A5: Attach trigger to profiles
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_field_audit ON public.profiles;

CREATE TRIGGER trg_profiles_field_audit
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_profiles_field_audit();

-- ---------------------------------------------------------------------------
-- A6: v_member_history — normalised UNION ALL over profiles_audit + role_change_audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_member_history AS
  SELECT
    profile_id,
    changed_at,
    changed_by,
    'abo_number_change'::text       AS event_type,
    'abo_number'::text              AS field,
    old_abo_number                  AS old_value,
    new_abo_number                  AS new_value
  FROM public.profiles_audit
  WHERE old_abo_number IS DISTINCT FROM new_abo_number

  UNION ALL

  SELECT
    profile_id,
    changed_at,
    changed_by,
    'upline_abo_number_change'::text AS event_type,
    'upline_abo_number'::text        AS field,
    old_upline_abo_number            AS old_value,
    new_upline_abo_number            AS new_value
  FROM public.profiles_audit
  WHERE old_upline_abo_number IS DISTINCT FROM new_upline_abo_number

  UNION ALL

  SELECT
    profile_id,
    changed_at,
    changed_by,
    'primary_profile_id_change'::text AS event_type,
    'primary_profile_id'::text        AS field,
    old_primary_profile_id::text      AS old_value,
    new_primary_profile_id::text      AS new_value
  FROM public.profiles_audit
  WHERE old_primary_profile_id IS DISTINCT FROM new_primary_profile_id

  UNION ALL

  SELECT
    profile_id,
    changed_at,
    changed_by,
    'role_change'::text AS event_type,
    'role'::text        AS field,
    old_role            AS old_value,
    new_role            AS new_value
  FROM public.profiles_audit
  WHERE old_role IS DISTINCT FROM new_role

  UNION ALL

  SELECT
    profile_id,
    changed_at,
    changed_by,
    'role_change'::text AS event_type,
    'role'::text        AS field,
    old_role::text      AS old_value,
    new_role::text      AS new_value
  FROM public.role_change_audit;

-- ---------------------------------------------------------------------------
-- B: approve_member_verification — add secondary profile guard
--    Full CREATE OR REPLACE from 20260510_001 body + guard injected after
--    the FOR UPDATE lock, before any writes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_member_verification(
  p_request_id uuid,
  p_admin_note text DEFAULT NULL::text
)
RETURNS TABLE(profile_id uuid, abo_number text, upline_abo_number text, role text, tree_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req        public.abo_verification_requests%ROWTYPE;
  v_los_sponsor text;
BEGIN
  -- Authorization: service_role (Path C) or admin users (Path B)
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Lock the request row for the duration of the transaction
  SELECT * INTO v_req
  FROM public.abo_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request % not found', p_request_id;
  END IF;

  -- Guard: secondary profiles cannot receive standalone verification
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_req.profile_id
      AND primary_profile_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'secondary profile % cannot receive standalone verification', v_req.profile_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency guard: re-running on an already-approved request
  -- raises unique_violation (SQLSTATE 23505) so callers can 409.
  IF v_req.status = 'approved' THEN
    RAISE EXCEPTION 'request % is already approved', p_request_id
      USING ERRCODE = '23505';
  END IF;

  -- Guard: standard path must have a non-null claimed_abo
  IF v_req.request_type = 'standard' AND v_req.claimed_abo IS NULL THEN
    RAISE EXCEPTION 'standard verification request % has null claimed_abo — cannot approve', p_request_id;
  END IF;

  IF v_req.request_type = 'standard' THEN
    -- LOS existence guard — qualify abo_number to avoid ambiguity with RETURNS TABLE column
    SELECT los_members.sponsor_abo_number INTO v_los_sponsor
    FROM public.los_members
    WHERE los_members.abo_number = v_req.claimed_abo;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ABO % not found in los_members — re-import LOS before approving', v_req.claimed_abo;
    END IF;

    -- Sponsor mismatch guard
    IF v_los_sponsor IS DISTINCT FROM v_req.claimed_upline_abo THEN
      RAISE EXCEPTION 'ABO % sponsor in LOS is % but request claims % — data mismatch',
        v_req.claimed_abo, v_los_sponsor, v_req.claimed_upline_abo;
    END IF;

    -- Duplicate guard: another profile already owns this ABO
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.abo_number = v_req.claimed_abo
        AND profiles.id <> v_req.profile_id
    ) THEN
      RAISE EXCEPTION 'ABO % is already claimed by another profile', v_req.claimed_abo;
    END IF;
  END IF;

  IF v_req.request_type = 'manual' THEN
    UPDATE public.profiles
    SET role              = 'member',
        upline_abo_number = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  ELSE
    UPDATE public.profiles
    SET role              = 'member',
        abo_number        = v_req.claimed_abo,
        upline_abo_number = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  END IF;

  -- Mark approved
  UPDATE public.abo_verification_requests
  SET status      = 'approved',
      resolved_at = now(),
      admin_note  = p_admin_note
  WHERE id = p_request_id;

  -- Place in tree
  PERFORM public.upsert_tree_node(
    p_profile_id         => v_req.profile_id,
    p_abo_number         => v_req.claimed_abo,
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );

  -- Return the promoted profile row for caller confirmation
  RETURN QUERY
  SELECT p.id,
         p.abo_number,
         p.upline_abo_number,
         p.role::text,
         t.path::text
  FROM public.profiles p
  LEFT JOIN public.tree_nodes t ON t.profile_id = p.id
  WHERE p.id = v_req.profile_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$function$;

-- ---------------------------------------------------------------------------
-- C: One-time cleanup — orphaned tree_nodes row for secondary cb703519
-- ---------------------------------------------------------------------------
DELETE FROM public.tree_nodes
WHERE profile_id = 'cb703519-866b-448c-959a-4945d9c21272';
