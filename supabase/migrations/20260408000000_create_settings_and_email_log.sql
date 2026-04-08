-- settings: generic key-value config table
CREATE TABLE public.settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read settings"
  ON public.settings FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin write settings"
  ON public.settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

INSERT INTO public.settings (key, value) VALUES (
  'email_config',
  '{
    "enabled": false,
    "alert_recipient": "",
    "notification_types": {
      "trip_registration_status": true,
      "trip_registration_cancelled": true,
      "payment_status": true,
      "abo_verification_result": true,
      "event_role_request_result": true,
      "document_expiring_soon": true,
      "welcome": true
    }
  }'::jsonb
);

-- email_log: audit trail and retry surface
CREATE TABLE public.email_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template    text        NOT NULL,
  recipient   text        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  resend_id   text,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read email_log"
  ON public.email_log FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role write email_log"
  ON public.email_log FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX email_log_status_idx ON public.email_log (status, created_at DESC);
CREATE INDEX email_log_template_idx ON public.email_log (template, created_at DESC);
CREATE INDEX email_log_dedup_idx ON public.email_log (template, recipient, created_at DESC);
