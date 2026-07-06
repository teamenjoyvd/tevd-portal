-- =============================================================================
-- Migration: 20260705_005_notification_delivery_log.sql
-- Description: Creates the notification_delivery_log table.
-- =============================================================================

CREATE TABLE public.notification_delivery_log (
  id         uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id   uuid                     NULL REFERENCES public.notification_queue(id) ON DELETE SET NULL,
  channel    public.notification_channel NOT NULL,
  template   text                     NOT NULL,
  recipient  text                     NOT NULL,
  status     text                     NOT NULL,
  error      text                     NULL,
  resend_id  text                     NULL,
  payload    jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz              NOT NULL DEFAULT now(),
  
  -- Status verification (sent vs failed)
  CONSTRAINT notification_delivery_log_status_check CHECK (
    status IN ('sent', 'failed')
  )
);

-- Performance and Audit Indexes
CREATE INDEX notification_delivery_log_queue_id_idx 
  ON public.notification_delivery_log (queue_id);

CREATE INDEX notification_delivery_log_channel_idx 
  ON public.notification_delivery_log (channel);

CREATE INDEX notification_delivery_log_created_at_idx 
  ON public.notification_delivery_log (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Pattern A Helpers Only)
CREATE POLICY "Admins manage all logs" 
  ON public.notification_delivery_log 
  FOR ALL 
  TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Service role full access" 
  ON public.notification_delivery_log 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);
