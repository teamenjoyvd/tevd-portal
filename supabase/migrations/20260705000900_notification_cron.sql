-- =============================================================================
-- Migration: 20260705000900_notification_cron.sql
-- Description: Unschedule old cron jobs and schedule new notification cron jobs.
-- =============================================================================

-- 1. Idempotently unschedule existing pg_cron jobs if they exist
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('send-event-reminders', 'check-document-expiry');

-- 2. Idempotently unschedule new cron jobs if they already exist (for rerun-ability)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'deliver-email-notifications',
  'deliver-inapp-notifications',
  'enqueue-document-expiry',
  'notification-cleanup'
);

-- 3. Schedule 4 new cron jobs

-- deliver-email-notifications: Runs every 5 minutes ('*/5 * * * *')
SELECT cron.schedule(
  'deliver-email-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ynykjpnetfwqzdnsgkkg.supabase.co/functions/v1/deliver-email-notifications',
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

-- deliver-inapp-notifications: Runs every 1 minute ('* * * * *')
SELECT cron.schedule(
  'deliver-inapp-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ynykjpnetfwqzdnsgkkg.supabase.co/functions/v1/deliver-inapp-notifications',
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

-- enqueue-document-expiry: Runs daily at 8:00 AM ('0 8 * * *')
SELECT cron.schedule(
  'enqueue-document-expiry',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ynykjpnetfwqzdnsgkkg.supabase.co/functions/v1/enqueue-document-expiry',
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

-- notification-cleanup: Runs weekly on Sunday at midnight ('0 0 * * 0')
SELECT cron.schedule(
  'notification-cleanup',
  '0 0 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://ynykjpnetfwqzdnsgkkg.supabase.co/functions/v1/notification-cleanup',
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
