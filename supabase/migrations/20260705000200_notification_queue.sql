-- =============================================================================
-- Migration: 20260705_002_notification_queue.sql
-- Description: Creates the notification_queue table.
-- =============================================================================

CREATE TABLE public.notification_queue (
  id              uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid                     NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_id uuid                     NULL REFERENCES public.guest_registrations(id) ON DELETE CASCADE,
  event_id        uuid                     NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  type            public.notification_queue_type NOT NULL,
  channel         public.notification_channel    NOT NULL,
  status          text                     NOT NULL DEFAULT 'pending',
  payload         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  send_at         timestamptz              NOT NULL DEFAULT now(),
  sent_at         timestamptz              NULL,
  claimed_at      timestamptz              NULL,
  claimed_by      text                     NULL,
  attempts        integer                  NOT NULL DEFAULT 0,
  max_attempts    integer                  NOT NULL DEFAULT 3,
  last_error      text                     NULL,
  created_at      timestamptz              NOT NULL DEFAULT now(),
  updated_at      timestamptz              NOT NULL DEFAULT now(),
  
  -- Status verification constraint (5 states)
  CONSTRAINT notification_queue_status_check CHECK (
    status IN ('pending', 'claimed', 'sent', 'failed', 'permanently_failed')
  ),
  
  -- Prevent multiple queue records of the same type for a guest registration
  CONSTRAINT notification_queue_registration_type_key UNIQUE (registration_id, type)
);

-- Performance and worker queue indexes
CREATE INDEX notification_queue_send_at_status_idx 
  ON public.notification_queue (send_at) 
  WHERE (status IN ('pending', 'failed'));

CREATE INDEX notification_queue_profile_id_idx 
  ON public.notification_queue (profile_id);

CREATE INDEX notification_queue_registration_id_idx 
  ON public.notification_queue (registration_id);

CREATE INDEX notification_queue_event_id_idx 
  ON public.notification_queue (event_id);

-- Trigger to handle updated_at automatically
CREATE OR REPLACE FUNCTION public.update_notification_queue_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_queue_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_queue_updated_at();

-- Enable Row Level Security
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Pattern A Helpers Only)
CREATE POLICY "Admins manage all notification_queue" 
  ON public.notification_queue 
  FOR ALL 
  TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view own queued notifications" 
  ON public.notification_queue 
  FOR SELECT 
  TO authenticated 
  USING (profile_id = public.get_my_profile_id());

CREATE POLICY "Service role full access" 
  ON public.notification_queue 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);
