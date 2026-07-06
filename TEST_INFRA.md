# TEST_INFRA.md

## Test Philosophy
The test suite utilizes an **opaque-box, requirement-driven** testing philosophy. It focuses on validating that the system behaves correctly under specified requirements, independent of internal implementation details. The tests check behavior via API endpoints, public RPC interfaces, database triggers, and admin server actions, using actual database connections and API calls in Live Mode and high-fidelity simulated drivers in Mock Mode.

## Feature Inventory
The system consists of the following N=6 features:
1. **Queue-based notification enqueue/claim**: Covers `notification_queue` CRUD and the `claim_due_notifications` RPC.
2. **Renamed member_notifications in-app feed**: Covers in-app feed endpoints and queries targetting the `member_notifications` table (renamed from `notifications`).
3. **Guest reminder triggers**: Covers the `fn_schedule_guest_reminders` and `fn_reschedule_guest_reminders` database triggers.
4. **Edge functions delivery with retry/logging**: Covers Deno Edge function workers, Resend API integration, and retry/logging logic.
5. **Document expiry cron & dedup**: Covers daily scanners, warning enqueues, and the 60-day deduplication logic.
6. **Admin panel configurations & server actions**: Covers the settings table, server actions, and UI pill state visualization.

---

## Test Case Layout & Feature Matrix

### Tier 1: Feature Coverage (30 Cases)
Provides baseline functional verification for each individual feature under standard, happy-path conditions (5 cases per feature).

| Test ID | Feature | Description |
|---|---|---|
| `T1_F1_01` | Feature 1 | Verify standard pending notification enqueue in `notification_queue`. |
| `T1_F1_02` | Feature 1 | Verify `claim_due_notifications` RPC picks up due pending notifications. |
| `T1_F1_03` | Feature 1 | Verify `claim_due_notifications` updates status from `pending` to `claimed`. |
| `T1_F1_04` | Feature 1 | Verify `claim_due_notifications` sets correct `claimed_at` timestamp and attempts count. |
| `T1_F1_05` | Feature 1 | Verify concurrent claims do not result in double-booking (lock-skipping). |
| `T1_F2_01` | Feature 2 | Verify `GET /api/notifications` returns the feed from `member_notifications`. |
| `T1_F2_02` | Feature 2 | Verify `PATCH /api/notifications/[id]` updates `is_read` to true. |
| `T1_F2_03` | Feature 2 | Verify `PATCH /api/notifications/[id]` updates `deleted_at` to mark it deleted. |
| `T1_F2_04` | Feature 2 | Verify `POST /api/notifications/read-all` marks all notifications as read. |
| `T1_F2_05` | Feature 2 | Verify `DELETE /api/notifications` with `{"all": true}` marks all as deleted. |
| `T1_F3_01` | Feature 3 | Verify scheduling a calendar event triggers reminder insertion in the queue. |
| `T1_F3_02` | Feature 3 | Verify scheduler creates both 1-hour and 15-minute reminders if enabled. |
| `T1_F3_03` | Feature 3 | Verify reminder triggers capture correct payload snapshots. |
| `T1_F3_04` | Feature 3 | Verify updating event start time triggers rescheduling of reminders. |
| `T1_F3_05` | Feature 3 | Verify canceling a calendar event deletes/cancels reminders. |
| `T1_F4_01` | Feature 4 | Verify email worker claims and delivers email notifications using Resend API. |
| `T1_F4_02` | Feature 4 | Verify successful email delivery marks queue item as `sent` and sets `sent_at`. |
| `T1_F4_03` | Feature 4 | Verify successful email delivery writes to `notification_delivery_log`. |
| `T1_F4_04` | Feature 4 | Verify in-app worker claims and writes to `member_notifications`. |
| `T1_F4_05` | Feature 4 | Verify failed delivery increments attempts and sets status back to `failed` (for retry). |
| `T1_F5_01` | Feature 5 | Verify document expiry scanner identifies expiring documents in warning window. |
| `T1_F5_02` | Feature 5 | Verify document expiry scanner enqueues warning notifications. |
| `T1_F5_03` | Feature 5 | Verify document expiry notifications use correct channel/template. |
| `T1_F5_04` | Feature 5 | Verify document expiry deduplication within 60-day window. |
| `T1_F5_05` | Feature 5 | Verify renewed documents do not get warning notifications. |
| `T1_F6_01` | Feature 6 | Verify `toggleGlobalReminder` server action updates settings. |
| `T1_F6_02` | Feature 6 | Verify `toggleEventReminders` server action overrides settings for an event. |
| `T1_F6_03` | Feature 6 | Verify `cancelReminder` server action removes/cancels a pending reminder. |
| `T1_F6_04` | Feature 6 | Verify `resendReminder` server action resets a sent reminder to be sent immediately. |
| `T1_F6_05` | Feature 6 | Verify `rescheduleReminder` server action updates a reminder's `send_at` timestamp. |

---

### Tier 2: Boundary & Corner Cases (30 Cases)
Tests edge inputs, limits, error handling, RLS restrictions, and boundary behavior (5 cases per feature).

| Test ID | Feature | Description |
|---|---|---|
| `T2_F1_01` | Feature 1 | Verify `claim_due_notifications` ignores notifications with `send_at` in the future. |
| `T2_F1_02` | Feature 1 | Verify `claim_due_notifications` respects the limit parameter. |
| `T2_F1_03` | Feature 1 | Verify invalid channel parameter throws or returns empty in `claim_due_notifications`. |
| `T2_F1_04` | Feature 1 | Verify `claim_due_notifications` does not claim already sent/failed/permanently failed items. |
| `T2_F1_05` | Feature 1 | Verify `claim_due_notifications` behavior when queue is empty. |
| `T2_F2_01` | Feature 2 | Verify unauthorized access to `/api/notifications` is blocked (401). |
| `T2_F2_02` | Feature 2 | Verify bad request to `/api/notifications` DELETE (no all: true) returns 400. |
| `T2_F2_03` | Feature 2 | Verify patching a non-existent notification returns 404. |
| `T2_F2_04` | Feature 2 | Verify GET feed ignores deleted notifications. |
| `T2_F2_05` | Feature 2 | Verify RLS prevents a user from reading another user's in-app feed. |
| `T2_F3_01` | Feature 3 | Verify rescheduling trigger is skipped if start time is unchanged (IS DISTINCT FROM). |
| `T2_F3_02` | Feature 3 | Verify no reminder is scheduled if reminders are disabled on the event. |
| `T2_F3_03` | Feature 3 | Verify changing start time to past sets `send_at` in past (immediate pickup). |
| `T2_F3_04` | Feature 3 | Verify guest updates correctly update email/name fields in the payload snapshot. |
| `T2_F3_05` | Feature 3 | Verify deleting guest registration removes associated reminders. |
| `T2_F4_01` | Feature 4 | Verify email delivery attempts are capped at exactly 3. |
| `T2_F4_02` | Feature 4 | Verify in-app delivery attempts are capped at exactly 5. |
| `T2_F4_03` | Feature 4 | Verify retry backoff applies exponential delay. |
| `T2_F4_04` | Feature 4 | Verify failed delivery writes error messages to queue `last_error`. |
| `T2_F4_05` | Feature 4 | Verify edge function delivery endpoints enforce security. |
| `T2_F5_01` | Feature 5 | Verify document scanner matches both doc ID and profile ID for dedup. |
| `T2_F5_02` | Feature 5 | Verify document scanner handles documents expiring exactly at 30/60 days. |
| `T2_F5_03` | Feature 5 | Verify already expired documents are not repeatedly enqueued. |
| `T2_F5_04` | Feature 5 | Verify document scanner enqueues correctly if no duplicate is in the 60-day window. |
| `T2_F5_05` | Feature 5 | Verify daily cron scanner completes successfully with no expiring documents. |
| `T2_F6_01` | Feature 6 | Verify unauthorized users cannot run admin server actions. |
| `T2_F6_02` | Feature 6 | Verify rescheduling to a past time is rejected. |
| `T2_F6_03` | Feature 6 | Verify canceling an already sent reminder is handled gracefully. |
| `T2_F6_04` | Feature 6 | Verify toggling an invalid/non-existent setting key throws or returns false. |
| `T2_F6_05` | Feature 6 | Verify resending a sent reminder resets attempt count to 0. |

---

### Tier 3: Cross-Feature Combinations (6 Cases)
Tests integration and flow between different features.

| Test ID | Target Features | Description |
|---|---|---|
| `T3_01` | F1 & F4 | Enqueuing a notification makes it immediately claimable and sent by the worker. |
| `T3_02` | F3 & F6 | Scheduling an event triggers a reminder, then admin `cancelReminder` removes it. |
| `T3_03` | F2 & F5 | Document expiry scanner enqueues an in-app warning, worker delivers it, feed displays it. |
| `T3_04` | F4 & F6 | Resending a failed/sent reminder resets attempts to 0 and makes it claimable by the worker. |
| `T3_05` | F3 & F4 | Reminder triggers capture email from registration, worker sends via Resend API to that email. |
| `T3_06` | F3 & F6 | Disabling reminders globally via config stops the reminder triggers from enqueuing new rows. |

---

### Tier 4: Real-World Application Scenarios (5 Cases)
End-to-end user workflows simulating realistic environment conditions and lifecycle events.

| Test ID | Description |
|---|---|
| `T4_01` | **Complete Event Lifecycle**: Schedule event -> reminders generated -> update start time -> reminders rescheduled -> admin overrides one manually -> worker claims and sends. |
| `T4_02` | **Edge Function Outage Recovery**: API returns 500 -> retry backoff -> API recovers -> next cron successfully claims and sends pending items. |
| `T4_03` | **Multi-user Concurrent Interaction**: High load of users requesting/updating feeds and background worker claims/sends. |
| `T4_04` | **Expired Document Renewal**: Expiring warning enqueued -> user renews document -> next cron scan does not duplicate and ignores. |
| `T4_05` | **Critical System Administration**: Emails fail -> admin corrects guest email -> admin triggers resend -> worker delivers successfully. |

---

## Feature Checklist
- [x] Feature 1: Queue-based notification enqueue/claim
- [x] Feature 2: Renamed member_notifications in-app feed
- [x] Feature 3: Guest reminder triggers
- [x] Feature 4: Edge functions delivery with retry/logging
- [x] Feature 5: Document expiry cron & dedup
- [x] Feature 6: Admin panel configurations & server actions
