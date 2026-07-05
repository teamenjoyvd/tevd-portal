-- =============================================================================
-- Migration: 20260705_006_member_notifications.sql
-- Description: Renames notifications to member_notifications and adjusts RLS.
-- =============================================================================

-- 1. Rename table notifications to member_notifications
ALTER TABLE public.notifications RENAME TO member_notifications;

-- 2. Rename Primary Key constraint
ALTER TABLE public.member_notifications 
  RENAME CONSTRAINT notifications_pkey TO member_notifications_pkey;

-- 3. Rename Foreign Key constraint
ALTER TABLE public.member_notifications 
  RENAME CONSTRAINT notifications_profile_id_fkey TO member_notifications_profile_id_fkey;

-- 4. Re-establish Row Level Security and Policies
-- Drop old policies that belong to the renamed table
DROP POLICY IF EXISTS "Admins full notification access" ON public.member_notifications;
DROP POLICY IF EXISTS "Users see own notifications" ON public.member_notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.member_notifications;

-- Create clean policies using Pattern A Helpers
CREATE POLICY "Admins manage all member_notifications" 
  ON public.member_notifications 
  FOR ALL 
  TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view own member_notifications" 
  ON public.member_notifications 
  FOR SELECT 
  TO authenticated 
  USING (profile_id = public.get_my_profile_id() AND deleted_at IS NULL);

CREATE POLICY "Users update own member_notifications" 
  ON public.member_notifications 
  FOR UPDATE 
  TO authenticated 
  USING (profile_id = public.get_my_profile_id()) 
  WITH CHECK (profile_id = public.get_my_profile_id());

CREATE POLICY "Service role full access" 
  ON public.member_notifications 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);
