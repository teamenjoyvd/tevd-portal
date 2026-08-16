-- 2608-DEV-749: add 'cancelled' to public.registration_status.
--
-- This file exists SOLELY for the ALTER TYPE. `ALTER TYPE ... ADD VALUE` cannot
-- be used in the same transaction that adds it, and the Supabase CLI wraps each
-- migration file in its own transaction — so the columns, the trigger function
-- and everything else that references the new value live in the sibling file
-- 20260816000100_2608_feat_749_role_cancel.sql.
--
-- NOTE, accepted knowingly: `registration_status` is shared with
-- trip_registrations.status (20260315000000_baseline.sql:75) and
-- event_role_requests.status (:153). Postgres cannot DROP an enum value, so
-- this migration is IRREVERSIBLE — see the ROLLBACK note below.
--
-- ROLLBACK: not possible. Postgres has no `ALTER TYPE ... DROP VALUE`. Reverting
-- this feature means leaving 'cancelled' present but unused; the only true
-- removal is a full type swap (create a new enum, ALTER every dependent column
-- with a USING cast, drop the old type), which is not worth doing for an unused
-- label. Undo the behaviour in the sibling migration instead.

ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'cancelled';
