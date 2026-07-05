-- =============================================================================
-- Migration: 20260705_003_notification_preferences.sql
-- Description: Creates the notification_preferences table.
-- =============================================================================

CREATE TABLE public.notification_preferences (
  profile_id     uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled  boolean     NOT NULL DEFAULT true,
  in_app_enabled boolean     NOT NULL DEFAULT true,
  preferences    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Trigger to handle updated_at automatically
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- Enable Row Level Security
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Pattern A Helpers Only)
CREATE POLICY "Admins manage all notification_preferences" 
  ON public.notification_preferences 
  FOR ALL 
  TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view own preferences" 
  ON public.notification_preferences 
  FOR SELECT 
  TO authenticated 
  USING (profile_id = public.get_my_profile_id());

CREATE POLICY "Users update own preferences" 
  ON public.notification_preferences 
  FOR UPDATE 
  TO authenticated 
  USING (profile_id = public.get_my_profile_id()) 
  WITH CHECK (profile_id = public.get_my_profile_id());

CREATE POLICY "Users insert own preferences" 
  ON public.notification_preferences 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (profile_id = public.get_my_profile_id());

CREATE POLICY "Service role full access" 
  ON public.notification_preferences 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);
