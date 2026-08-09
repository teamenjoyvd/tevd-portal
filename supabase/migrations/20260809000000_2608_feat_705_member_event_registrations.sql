-- ROLLBACK: DROP INDEX IF EXISTS public.idx_guest_registrations_profile_id;
--           DROP INDEX IF EXISTS public.guest_registrations_event_profile_uniq;
--           ALTER TABLE public.guest_registrations
--             DROP CONSTRAINT IF EXISTS guest_registrations_guest_xor_member_chk;
--           ALTER TABLE public.guest_registrations DROP COLUMN IF EXISTS profile_id;
--           -- The three NOT NULLs below can only be restored while no member row exists:
--           --   ALTER TABLE public.guest_registrations
--           --     ALTER COLUMN email SET NOT NULL,
--           --     ALTER COLUMN token SET NOT NULL,
--           --     ALTER COLUMN expires_at SET NOT NULL;
--           -- Once T4 writes member rows (email/token/expires_at NULL) this is a one-way door.
-- ============================================================
-- [2608-DEV-705] Member registrations on guest_registrations
--
-- Part of #702. Enabling work only — nothing writes profile_id yet; that
-- arrives in T4 (#706). This migration just makes the schema, and the code
-- reading it, tolerate a row that represents a MEMBER rather than a guest.
--
-- Per D7 the table is extended in place rather than renamed. A rename would
-- drag the reminder trigger, the notification_queue and scheduled_reminders
-- FKs, the cron job, approve_event_role_request, the seed scripts and the e2e
-- fixtures with it, for no functional gain.
--
-- Shape: a row is EITHER a guest (email + token + expires_at, no profile_id)
-- OR a member (profile_id, none of the three). The CHECK below is what makes
-- that exclusive; without it a half-populated row is silently representable.
--
-- Expand/contract: every statement here is additive or widening, so the
-- currently-deployed code stays correct while this waits for the gated prod
-- run. Old code writes guest rows with all three columns populated -> passes
-- the CHECK. There is no contract step.
-- ============================================================

ALTER TABLE public.guest_registrations
  ADD COLUMN profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.guest_registrations
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN token DROP NOT NULL,
  ALTER COLUMN expires_at DROP NOT NULL;

-- `name` deliberately stays NOT NULL: three call sites invoke string methods
-- on it unguarded (lib/server/event-shares.ts, app/api/profile/event-shares/
-- export/route.ts, lib/invites-pdf.ts). Member rows snapshot the profile
-- display name at insert time.
COMMENT ON COLUMN public.guest_registrations.name IS
  'Display name. For member rows (profile_id IS NOT NULL) this is a SNAPSHOT of the profile name taken at insert time — a later profile rename does NOT propagate here. Kept NOT NULL so existing readers can call string methods on it unguarded.';

COMMENT ON COLUMN public.guest_registrations.profile_id IS
  'Set when this registration belongs to a portal member instead of an external guest. Mutually exclusive with email/token/expires_at (guest_registrations_guest_xor_member_chk). Nothing writes this until 2608-DEV-706.';

ALTER TABLE public.guest_registrations
  ADD CONSTRAINT guest_registrations_guest_xor_member_chk CHECK (
    (profile_id IS NULL     AND email IS NOT NULL AND token IS NOT NULL AND expires_at IS NOT NULL)
    OR
    (profile_id IS NOT NULL AND email IS NULL     AND token IS NULL     AND expires_at IS NULL)
  );

-- One registration per member per event. Partial so guest rows (profile_id
-- NULL) are untouched by it.
CREATE UNIQUE INDEX guest_registrations_event_profile_uniq
  ON public.guest_registrations (event_id, profile_id) WHERE profile_id IS NOT NULL;

CREATE INDEX idx_guest_registrations_profile_id
  ON public.guest_registrations (profile_id) WHERE profile_id IS NOT NULL;

-- The pre-existing UNIQUE (event_id, email) needs no change: Postgres treats
-- NULLs as distinct, so member rows never collide on it.
