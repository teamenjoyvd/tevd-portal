-- =============================================================================
-- Migration: 20260705_001_notification_enums.sql
-- Description: Defines notification_queue_type and notification_channel enums.
-- =============================================================================

CREATE TYPE public.notification_queue_type AS ENUM (
  'event_reminder_1h',
  'event_reminder_15m',
  'doc_expiry'
);

CREATE TYPE public.notification_channel AS ENUM (
  'email',
  'in_app'
);
