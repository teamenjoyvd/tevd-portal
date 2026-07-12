-- #555: repair prod schema drift found while mirroring prod data for #547.
-- Two objects exist in prod but were created by no migration (same drift
-- class as settings/email_log). Definitions copied verbatim from prod
-- catalogs (2026-07-12). IF NOT EXISTS makes both no-ops if applied to prod.
-- Full-catalog diff (prod vs fresh local replay) showed exactly these two;
-- all other tables/columns/enum values match.

-- 1. profiles.notification_prefs — read/written by /api/profile and the
--    profile EmailPrefsSection.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL
  DEFAULT '{"payment_status": true, "document_expiring_soon": true, "abo_verification_result": true, "trip_registration_status": true, "event_role_request_result": true}'::jsonb;

-- 2. notification_type value used by prod rows in member_notifications.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'spouse_link_request';
