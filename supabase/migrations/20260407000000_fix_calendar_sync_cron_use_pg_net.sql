-- Fix: cron job was calling extensions.http_post() which belongs to the
-- uninstalled `http` extension. pg_net is the installed extension and uses
-- net.http_post(). The cron was firing every hour and silently doing nothing,
-- causing calendar events added after the initial sync to never appear.

SELECT cron.unschedule('sync-google-calendar');

SELECT cron.schedule(
  'sync-google-calendar',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ynykjpnetfwqzdnsgkkg.supabase.co/functions/v1/sync-google-calendar',
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
