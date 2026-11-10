# Backlog

Known issues not yet filed or fixed. When you pick one up, open a GitHub issue for it and delete the line here in the same PR.

## Security and data safety
- **DEV cron calls PROD edge functions.** `supabase/migrations/20260407000000_fix_calendar_sync_cron_use_pg_net.sql:13` hardcodes the PROD URL for `sync-google-calendar`, and the later migration wins over the baseline (`20260315000000_baseline.sql:1096`), so every project that replays migrations schedules an hourly call to PROD. `check-document-expiry`, `send-event-reminders` and four notification functions hardcode the PROD ref the same way. The URL should come from a setting.
- **RPC service-role guards fail open on NULL.** About 16 migrations use `IF auth.role() <> 'service_role' AND NOT is_admin()`. With no JWT claims `auth.role()` is NULL, so the guard does not fire. Not reachable through PostgREST, but sweep them to `IS DISTINCT FROM` (as in `20260705000700_notification_rpcs.sql`).
- **Email kill switch can fail open.** `lib/email/send.ts:129` reads `if (!config.enabled)`; a row holding `"true"` or `1` passes. Use `!== true`, as #715 did elsewhere.
- **Case-sensitive email match.** `lib/server/member-registration.ts` uses `.eq('email', contactEmail)` in `attendEvent`'s adopt step. Needs `lower()`/`citext` or `.ilike()` (fixed in the #710 RPC, not here).
- **Null `contact_email` is skipped silently** at `lib/abo/verifyAbo.ts:226`, both spouse-link routes, `app/api/admin/members/verify/[id]/route.ts:99`, and `lib/server/member-registration.ts`. A shared `resolveProfileEmail()` would fix all of them.

## Events and registrations
- `fn_schedule_guest_reminders_record`'s `ON CONFLICT ... DO UPDATE SET status = 'pending', attempts = 0` has no `WHERE`, so attend → cancel → attend resets an already-sent reminder to pending.
- `lib/server/event-capacity.ts:41-45` excludes approved role holders from the guest headcount; after a role cancel the person starts counting, so an at-capacity event can go one over. Accepted for now.
- `event_role_requests.event_id` has no `ON DELETE CASCADE` (`baseline.sql:158`), so deleting a calendar event with role requests fails on the FK.
- A signed-in member blocked by a FULL event still gets `ResendLinkForm` at `app/events/[eventId]/register/page.tsx:179` and `:216`.
- `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`) still uses the detached-anchor + synchronous `revokeObjectURL` pattern fixed in `components/AddToCalendarMenu.tsx`.
- `app/api/calendar/feed-token/route.ts:21,45,81` and `app/api/profile/spouse-link/route.ts:138` call `await getBaseUrl()` unguarded.
- `types/supabase.ts:2370` types five `get_event_registrations_for_viewer` return fields as non-nullable `string`; all five are NULL in normal operation.

## UI
- **#746** Radius Phase 2: `app/admin/**` still uses `rounded-full` / `rounded-lg` / `rounded-xl` instead of `rounded-control` / `rounded-container`.
- `app/(dashboard)/profile/components/StatusBadge.tsx:50` replaces `className` instead of merging it, so eight callers drop `inline-flex items-center`. Fix with `cn()`.
- Hand-rolled switches in `RemindersTab`, `ReminderTable` and `EmailSettingsPanel` should use `components/ui/switch.tsx`.

## Tooling and CI
- **Port-54322 E2E flake.** Fixed by the "Reserve Supabase ports from the ephemeral range" step in `ci.yml` and `migrations-check.yml`. Delete this line after ~20 green Authenticated E2E runs with no bind error.
- **Clerk FAPI flake.** Authenticated E2E can fail wholesale at `clerk.signIn()` with "FAPI request failed after 4 attempts". Re-run the same commit.
- `scripts/local-gate.js:160` warns falsely when a local `.git/hooks/pre-push` hands off to `.githooks/pre-push`, because it reads only `core.hooksPath`.
- `scripts/claude-hooks/dispatch.js:136` checks an Edit to a migration against the replacement text only, so it warns "migration lacks a -- ROLLBACK: comment" even when the file has one. It should read the file from disk.
- `e2e/server-watchdog-reporter.ts:57` calls `process.exit(1)`, skipping `test.afterAll`; seeded rows can be left in the shared DEV project.
- `npm run test:mock` enforces no foreign keys (`scripts/run-e2e-tests.js` in-memory mock), so it cannot catch FK-cascade bugs.
- `deno check` cannot run on the edge functions (`npm:openai` resolution via `jsr:@supabase/functions-js`), and `tsconfig.json` excludes `supabase/functions`, so the edge functions have no type gate.
- Moving the Supabase CLI from the 2.122.1 pin to v3 needs `db push --yes` and `--remote` in `.github/workflows/migrate-prod.yml`, in its own PR.
