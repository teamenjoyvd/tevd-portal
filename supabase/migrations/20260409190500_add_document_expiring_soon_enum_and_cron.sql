-- Unschedule any existing cron for check-document-expiry to avoid conflicts
SELECT cron.unschedule('check-document-expiry');

-- Schedule a daily check using pg_cron at 8 AM
SELECT cron.schedule(
  'check-document-expiry',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ynykjpnetfwqzdnsgkkg.supabase.co/functions/v1/check-document-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'sync_secret'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
