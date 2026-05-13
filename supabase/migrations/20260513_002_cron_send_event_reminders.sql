-- Migration: pg_cron job for send-event-reminders edge function
-- Ticket: 2505-FEAT-346

-- Unschedule existing job (idempotent)
SELECT cron.unschedule('send-event-reminders');

-- Schedule every 5 minutes
SELECT cron.schedule(
  'send-event-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ynykjpnetfwqzdnsgkkg.supabase.co/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_secret' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
