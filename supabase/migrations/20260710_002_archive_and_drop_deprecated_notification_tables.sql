-- Issue #469: drop deprecated public.email_log and public.scheduled_reminders,
-- superseded by notification_delivery_log and notification_queue respectively
-- (migrated 2026-07-05, both DB-commented DEPRECATED since). Confirmed zero live
-- app/edge-function references, zero triggers, zero FKs, zero functions mention
-- either table.
--
-- NOTE: public.notifications is NOT touched here — it was renamed in-place to
-- public.member_notifications (live, 236 rows), not a separate deprecated table.
-- The original issue #469 task list was stale on this point (see issue comment,
-- 2026-07-07).
--
-- email_log has 115 rows of historical email-delivery records; archived to
-- archive.email_log (plain table, data + column shape only, no constraints/
-- indexes carried over) before dropping so the history remains queryable but
-- off the public/PostgREST-exposed surface. scheduled_reminders has 0 rows —
-- nothing to archive.

CREATE SCHEMA IF NOT EXISTS archive;

CREATE TABLE archive.email_log AS SELECT * FROM public.email_log;
COMMENT ON TABLE archive.email_log IS 'Archived 2026-07-10 from public.email_log before drop. See issue #469. Superseded by public.notification_delivery_log.';

DROP TABLE public.email_log;
DROP TABLE public.scheduled_reminders;
