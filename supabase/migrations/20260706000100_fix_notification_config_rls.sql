-- =============================================================================
-- Migration: 20260706000100_fix_notification_config_rls.sql
-- Description: Drops the broad "Members view notification_config" policy.
--              Now only admins and service_role can access notification_config.
-- =============================================================================

DROP POLICY IF EXISTS "Members view notification_config" ON public.notification_config;
