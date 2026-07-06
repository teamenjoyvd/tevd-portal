# Project: Queue-Based Notification Delivery System

Transition the portal's ad-hoc and direct notification dispatch mechanisms to a resilient, asynchronous queue-based delivery model.

## Architecture

```
                                  +---------------------+
                                  |   Database Events   |
                                  +----------+----------+
                                             | (Triggers)
                                             v
+------------------+              +----------+----------+
|  Next.js Server  |------------->|  notification_queue |
|   (Producers)    |  (Inserts)   +----------+----------+
+------------------+                         |
                                             | (claim_due_notifications)
                                             v
                                  +----------+----------+
                                  |    Edge Functions   |
                                  |      (Workers)      |
                                  +----+-----------+----+
                                       |           |
                              (Email)  v           v  (In-App Write)
                         +-------------+---+   +---+-----------------+
                         |   Resend API    |   | member_notifications|
                         +-----------------+   +---------------------+
```

- **Queue Storage**: Database table `notification_queue` acts as the persistent, transactional store for all pending and processing notifications.
- **Workers**:
  - `deliver-email-notifications`: Picks up email notifications from `notification_queue`, calls Resend API, handles retry/backoff, and logs results.
  - `deliver-inapp-notifications`: Picks up in-app notifications from `notification_queue`, writes to `member_notifications`, and logs results.
  - `enqueue-document-expiry`: Daily scanner that checks for expiring documents and enqueues warning entries in the queue.
- **Audit Logs**: Every attempt is logged to `notification_delivery_log` for full observability.
- **In-App Feed**: `notifications` table is renamed to `member_notifications` and remains the user-facing read feed.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | **M1: Data Layer Setup** | Create database migrations `20260705_001` through `20260705_006` (Enums, Queue, Preferences, Config, Log, member_notifications rename, data copy, RLS policies). | None | DONE |
| 2 | **M2: RPCs & Triggers** | Implement migrations `007` & `008` (`enqueue_notification`, `claim_due_notifications`, rewrite guest reminder triggers, and retarget all 8 other triggers). | M1 | DONE |
| 3 | **M3: Cron & Data Migration** | Implement migrations `009` & `010` (pg_cron setup, unscheduling old crons, data migration, and table deprecation comments). | M2 | DONE |
| 4 | **M4: Edge Functions** | Build three shared Deno modules and three Edge Functions with exponential backoff & retry. Delete old functions. | M3 | DONE |
| 5 | **M5: Next.js API & UI Integration** | Retarget Next.js API routes & producers to `member_notifications`. Update Admin Settings page, `RemindersTab.tsx`, actions, and implement 5-state `StatusPill`. | M3 | DONE |
| 6 | **M6: Verification & Handover** | Regenerate types via Supabase MCP, run typescript/lint/build checks, deploy/verify, and document 90-day table-drop issue. | M4, M5 | DONE |

## Interface Contracts

### 1. Database Schema
- `notification_queue`
  - `id`: uuid (PK)
  - `profile_id`: uuid (FK, nullable)
  - `registration_id`: uuid (FK, nullable)
  - `event_id`: uuid (FK, nullable)
  - `type`: `notification_queue_type` enum (`event_reminder_1h`, `event_reminder_15m`, `doc_expiry`)
  - `channel`: `notification_channel` enum (`email`, `in_app`)
  - `status`: text (`pending`, `claimed`, `sent`, `failed`, `permanently_failed`)
  - `payload`: jsonb (stores template data)
  - `send_at`: timestamptz
  - `sent_at`: timestamptz (nullable)
  - `claimed_at`: timestamptz (nullable)
  - `attempts`: integer
  - `max_attempts`: integer
  - `last_error`: text (nullable)
- `notification_delivery_log`
  - `id`: uuid (PK)
  - `queue_id`: uuid (FK, nullable)
  - `channel`: `notification_channel` enum
  - `template`: text
  - `recipient`: text
  - `status`: text (`sent`, `failed`)
  - `error`: text (nullable)
  - `resend_id`: text (nullable)
  - `payload`: jsonb
  - `created_at`: timestamptz

### 2. Edge Function RPC Interface
- `claim_due_notifications(p_channel, p_worker_id, p_limit)`:
  - Takes: `p_channel` (`notification_channel`), `p_worker_id` (text), `p_limit` (integer).
  - Returns: set of matching `notification_queue` rows (locked using `FOR UPDATE SKIP LOCKED`).
  - Access: restricted to `service_role` and `is_admin()`.

### 3. Next.js API Integration
- `/api/notifications`: Targets `member_notifications`.
- `/api/notifications/[id]`: Targets `member_notifications`.
- `/api/notifications/read-all`: Targets `member_notifications`.
- `/api/admin/email-log`: Queries `notification_delivery_log`.
- `/api/admin/settings/email/retry/[id]`: Triggers queue-based retry for the notification.

## Code Layout

- `supabase/migrations/` - SQL migration files (001 - 010).
- `supabase/functions/` - Deno Edge Functions and shared modules.
  - `_shared/` - Shared type definitions and templates.
  - `deliver-email-notifications/` - Email delivery worker.
  - `deliver-inapp-notifications/` - In-app delivery worker.
  - `enqueue-document-expiry/` - Document expiry scanning cron.
- `app/api/notifications/` - Next.js in-app notification feed endpoints.
- `app/admin/settings/` - Admin settings UI page and tab components.
  - `components/RemindersTab.tsx` - Visualizes the `notification_queue` with 5-state pill.
  - `components/NotificationsTab.tsx` - Visualizes the `member_notifications` table history.
  - `components/EmailLogTable.tsx` - Visualizes the `notification_delivery_log` table.
- `app/admin/actions/reminders.ts` - Server actions for admin queue management (cancel, resend, reschedule).
