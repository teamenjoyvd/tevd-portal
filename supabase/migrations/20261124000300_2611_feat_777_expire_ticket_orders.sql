-- [2611-DEV-777] Backstop: unpaid ticket orders expire after 25 hours (Stripe's
-- longest Checkout Session is 24). A late payment still fulfils, because
-- fulfill_ticket_order accepts 'expired'.
--
-- ROLLBACK: SELECT cron.unschedule('expire-ticket-orders');

SELECT cron.schedule(
  'expire-ticket-orders',
  '40 * * * *',
  $$
  UPDATE public.ticket_orders SET status = 'expired'
  WHERE status = 'pending' AND created_at < now() - interval '25 hours';
  $$
);
