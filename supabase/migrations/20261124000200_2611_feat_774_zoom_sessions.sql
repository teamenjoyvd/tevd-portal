-- [2611-DEV-774] Which Zoom webinar and session a calendar event is, and the
-- daily session import.
--
-- ROLLBACK: SELECT cron.unschedule('zoom-import-sessions');
--           DROP INDEX public.calendar_events_zoom_session_key;
--           ALTER TABLE public.calendar_events DROP COLUMN zoom_event_ref, DROP COLUMN zoom_session_ref;

ALTER TABLE public.calendar_events
  ADD COLUMN zoom_event_ref text,
  ADD COLUMN zoom_session_ref text;

-- Not partial: NULLs are already distinct, and PostgREST cannot name a partial
-- index in an upsert.
CREATE UNIQUE INDEX calendar_events_zoom_session_key
  ON public.calendar_events (zoom_event_ref, zoom_session_ref);

-- No row for 'app_base_url' (DEV, local) means no call. Reading Vault inside the
-- statement needs no function that PostgREST would expose.
SELECT cron.schedule(
  'zoom-import-sessions',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := b.decrypted_secret || '/api/internal/jobs/zoom-import-sessions',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', s.decrypted_secret),
    body := '{}'::jsonb
  )
  FROM vault.decrypted_secrets b, vault.decrypted_secrets s
  WHERE b.name = 'app_base_url' AND s.name = 'sync_secret';
  $$
);
