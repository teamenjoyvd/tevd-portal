-- [2611-DEV-776] One-time codes for moving a Join to another device, and the
-- minute jobs that finish registrations and retry emails. 'tickets-release-left'
-- is not scheduled until a live Zoom test shows a deleted person can register again.
--
-- ROLLBACK: SELECT cron.unschedule('ticket-jobs');
--           DROP TABLE public.ticket_device_codes;

CREATE TABLE public.ticket_device_codes (
  admission_id uuid PRIMARY KEY REFERENCES public.ticket_admissions(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);
-- RLS on with no policies: service role only.
ALTER TABLE public.ticket_device_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_device_codes FROM anon, authenticated;
GRANT ALL ON public.ticket_device_codes TO service_role;

-- Sofia hour 6 to 23. No 'app_base_url' row (DEV, local) means no call.
SELECT cron.schedule(
  'ticket-jobs',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := b.decrypted_secret || '/api/internal/jobs/' || j.name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', s.decrypted_secret),
    body := '{}'::jsonb
  )
  FROM vault.decrypted_secrets b, vault.decrypted_secrets s,
       (VALUES ('tickets-heal-zoom'), ('tickets-retry-email')) AS j(name)
  WHERE b.name = 'app_base_url' AND s.name = 'sync_secret'
    AND extract(hour FROM now() AT TIME ZONE 'Europe/Sofia') >= 6;
  $$
);
