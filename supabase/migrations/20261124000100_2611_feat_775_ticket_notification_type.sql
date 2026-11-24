-- 2611-DEV-775: admin notice when a ticket needs attention (stuck Zoom link).
-- Own file: a new enum value cannot be used in the transaction that adds it.
--
-- ROLLBACK: Postgres cannot drop an enum value. Leaving it unused is harmless.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ticket_alert';
