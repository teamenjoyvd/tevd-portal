-- =============================================================================
-- Migration: 20260705_004_notification_config.sql
-- Description: Creates the notification_config table and seeds default configs.
-- =============================================================================

CREATE TABLE public.notification_config (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  description text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger to handle updated_at automatically
CREATE OR REPLACE FUNCTION public.update_notification_config_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_config_updated_at
  BEFORE UPDATE ON public.notification_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_config_updated_at();

-- Enable Row Level Security
ALTER TABLE public.notification_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Pattern A Helpers Only)
CREATE POLICY "Admins manage all notification_config" 
  ON public.notification_config 
  FOR ALL 
  TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Members view notification_config" 
  ON public.notification_config 
  FOR SELECT 
  TO authenticated 
  USING (public.get_my_profile_id() IS NOT NULL OR public.is_admin());

CREATE POLICY "Service role full access" 
  ON public.notification_config 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Seed Default Config Rows
-- 1. email_settings config
INSERT INTO public.notification_config (key, value, description)
VALUES (
  'email_settings',
  '{
    "enabled": true,
    "alert_recipient": "admin@teamenjoyvd.com",
    "notification_types": {
      "role_request": true,
      "trip_request": true,
      "trip_created": true,
      "event_fetched": true,
      "doc_expiry": true,
      "los_digest": true,
      "trip_message": true,
      "trip_attachment": true
    }
  }'::jsonb,
  'Global email delivery configuration and per-type overrides'
)
ON CONFLICT (key) DO NOTHING;

-- 2. in_app_settings config
INSERT INTO public.notification_config (key, value, description)
VALUES (
  'in_app_settings',
  '{
    "enabled": true,
    "notification_types": {
      "role_request": true,
      "trip_request": true,
      "trip_created": true,
      "event_fetched": true,
      "doc_expiry": true,
      "los_digest": true,
      "trip_message": true,
      "trip_attachment": true
    }
  }'::jsonb,
  'Global in-app feed delivery configuration and per-type overrides'
)
ON CONFLICT (key) DO NOTHING;
