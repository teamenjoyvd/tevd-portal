## Goal
PLAN + CLAIM + BUILD issue #715 (2608-DEV-715) on branch `dev/2608-DEV-715` — sharer share-link
notifications skip every sharer with no `contact_email`, and are capped by nothing.

## Now
#715 is **pushed and open as DRAFT PR #731** (head `4dd255a`, CLAIM row at `b455e27`, branch rebased
onto `c6ba2f2`). `/code-review low` is done — its one finding (cap spent before the admin gates) is
fixed at `4dd255a`. Open gate: CI green + Vercel preview READY, then mark ready for one CodeRabbit
pass.

#714 is **merged**: PR #729 (`c6ba2f2`). No migration, so no prod gate. Its `docs/CLAIMS.md` row was
pruned by #715's CLAIM commit (`b455e27`), matching how `e20e072` pruned #713.

#713 is **merged**: PR #728 (`2f82d80`). #710 is **fully DONE**: PR #725 merged (`17fd786`), gated
`Migrate Prod` run 31471066200 succeeded, prod ledger head `20260811000000`, production smoke 200/200.
Epic #702 updated — all ten children merged, feature scope complete.

## Next
1. Resolve any `/code-review low` findings on the #715 diff.
2. DONE — pushed, draft PR #731 open. Wait for CI green + Vercel preview READY.
3. Mark ready → one CodeRabbit pass → fix all findings in ONE batched push.
4. Merge. No migration in #715, so there is no prod gate to approve afterwards — just a smoke check.
5. The `docs/CLAIMS.md` #715 row is pruned by the NEXT ticket's CLAIM commit, matching how `b455e27`
   pruned #714 and `e20e072` pruned #713 — never a standalone cleanup PR.
6. File the deferred follow-up: five other call sites silently skip on a null `contact_email`
   (`lib/abo/verifyAbo.ts:226`, both spouse-link routes, `app/api/admin/members/verify/[id]/route.ts:99`,
   `lib/server/member-registration.ts`) — a shared `resolveProfileEmail()` would fix all six.

## Constraints
- Never push without an explicit grant in this conversation. Grants from earlier tickets/sessions do
  not carry over.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the DEV stack.
  Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#715, from PLAN): sharer notifications are **notifications, not transactional mail** —
  they now dispatch through `sendNotificationEmail`, so `email_config.enabled` and the per-template
  toggle both apply. The sharer did not request each message. Consequence accepted: flipping the
  master switch off silences sharer mail too. Guest magic links stay transactional.
- DECISION (#715, from PLAN): fallback order is `contact_email` → **Clerk primary email**, not the
  issue's option 2 (require `contact_email` before minting a share link). `contact_email` is a
  preference and may be deliberately blank; Clerk's primary is the verified backstop. Profiles with
  no `clerk_id` (admin-created spouse/co-owner rows) keep the silent skip — no address exists.
- DECISION (#715, from PLAN): the cap bucket is **template-scoped**, unlike
  `guest-event-changes.ts`'s recipient-wide bucket — a registration burst through a viral link must
  not consume the budget that would otherwise deliver the cancellation notice. 10 per 24h.
- DECISION (#715, from BUILD): **no migration.** Keys absent from
  `notification_config.email_settings.notification_types` already pass the gate
  (`lib/email/send.ts:131` compares `=== false`), so the three admin toggles need no seed row — the
  panel writes the key on first toggle.
- DECISION (#713, from PLAN): the issue's **option 1** (resolve before any write), not option 2
  (degrade after). The `feed.ics` precedent at `:59-64` degrades *after* the point of no return
  because a feed has nothing to commit; `registerGuest` does. Hoisting is strictly better: the guest
  either registers and gets a link, or gets a clear error and is not silently half-signed-up.
- DECISION (#713, from PLAN): the Vercel fallback is a **positive allowlist** on
  `VERCEL_ENV === 'preview' | 'development'`, never `!== 'production'` — an unset or unknown
  `VERCEL_ENV` must not enable it. Production keeps the throw: a `*.vercel.app` magic link in a
  member's inbox is unbranded and phishing-shaped, and a prod misconfig should stay loud.
- DECISION (#713, from PLAN): `VERCEL_PROJECT_PRODUCTION_URL` is **omitted**. It did not appear in
  the Vercel docs search, and an unverified env var name is a guess.
- DECISION (#713, from PLAN): `.env.example` keeps `NEXT_PUBLIC_APP_URL` **optional**. Promoting it
  to required would fail `npm run check:env` on the local box for no gain once the fallback exists.

## Facts
- BASELINE 2026-08-11 on `dev/2608-DEV-713@f8f3a3f`:
  `npx vitest run lib/actions/guest-registration.test.ts lib/utils/base-url.test.ts lib/server/member-registration.test.ts`
  -> 3 files / **57 passed**. Full `npx vitest run` -> 32 files / **423 passed**. `npx eslint .` ->
  **0 errors / 465 warnings**. `npx tsc --noEmit` -> **1 error**, STALE GENERATED OUTPUT:
  `.next/dev/types/validator.ts(566,39)` still references the route deleted by #709. Not a source
  error; expect it until `.next` is regenerated.
- Vercel system env vars confirmed against the Vercel docs: `VERCEL_ENV`, `VERCEL_URL`,
  `VERCEL_BRANCH_URL` — all bare hostnames with no scheme, available at build AND runtime.
  `VERCEL_PROJECT_PRODUCTION_URL` was NOT confirmable and is deliberately unused.
- The member path already carried the #713 fix: `lib/server/member-registration.ts:62-104` wraps the
  whole confirmation send in `try/catch`, and `lib/server/member-registration.test.ts:527` is named
  `'never fails the attend when the link builder throws (#713 shape)'`. #713 was guest-path-only.
- `getBaseUrl` call sites, all dispositioned in the #713 reference sweep:
  `lib/actions/guest-registration.ts` (updated), `lib/server/member-registration.ts:74`,
  `app/api/calendar/feed.ics/route.ts:64`, `app/api/calendar/feed-token/route.ts:21,45,81`,
  `app/api/profile/spouse-link/route.ts:138` (all unaffected — each consumes the returned string).
- Production smoke 2026-08-11: `https://www.teamenjoyvd.com` 200, `/sign-in` 200.

## Done
- #715 PLAN + CLAIM + BUILD (code complete, `6a3b29f` + the review fix) — RESULT: 6 files.
  `lib/notifications/share-events.ts` gained `resolveSharerEmail` (contact_email → Clerk primary,
  Clerk failure caught) and `sendShareNotification` (admin gates, then a template-scoped 10/24h
  `consumeEmailCap`, then `sendNotificationEmail`); `EmailSettingsPanel.tsx` + `i18n/domains/admin/
  content.ts` expose the three toggles; `lib/email/send.ts` JSDoc lists the new caller. `/code-review
  low` found one real defect — the cap was spent BEFORE the gates, so a disabled template burned the
  sharer's daily budget; fixed by re-checking `getEmailConfig()` ahead of `consumeEmailCap`, covered
  by two new tests. Verified: `npx vitest run` -> 32 files / **443 passed** (baseline 441 on this
  branch's parent + 2); `npx tsc --noEmit` -> only the pre-existing stale `.next` error;
  `npx eslint` on the changed files -> clean.
- #714 CLOSED — RESULT: merged as PR #729 (`c6ba2f2`), no migration, no prod gate.
- #713 BUILD (code complete, `a97a7df`) — RESULT: 5 files. `lib/utils/base-url.ts` gained a
  `normalizeHost` helper + the preview/development Vercel fallback; `lib/actions/guest-registration.ts`
  hoists the resolve above every side effect in BOTH `registerGuest` and `resendGuestLink`;
  `.env.example` documents the fallback. Verified: `npx vitest run` -> 32 files / **433 passed**
  (baseline 423 + 10 new); `npx eslint .` -> 0 errors / 465 warnings (baseline 465);
  `npx tsc --noEmit` -> only the pre-existing stale `.next` error.
- #713 PLAN + CLAIM — RESULT: verdict READY; issue body carries the DoD, affected files, and four
  PLAN corrections (member path already fixed; option 1 over option 2; fallback excludes production;
  `.env.example` stays optional); Design Checklist 4/4; `## Branch dev/2608-DEV-713`; claim row
  committed at `f8f3a3f` with the merged #710 row pruned in the same commit.
- #702 epic updated — RESULT: all ten children (#703-#710) marked merged with their PR numbers, the
  "In flight"/"Ready to pick" sections collapsed, and a new "Follow-ups discovered during this epic"
  section lists #713 (in flight) plus unclaimed #714, #715, #718, #726, #727. The epic's feature
  scope is complete; the follow-ups explicitly do not block closing it.
- #710 CLOSED — RESULT: merged as PR #725 (`17fd786`); gated `Migrate Prod` run 31471066200 approved
  by the user and succeeded (`Applying migration 20260811000000_...` -> `Finished supabase db push`,
  ledger head after push `20260811000000`); production smoke 200/200. The #710 GCR fix (adopt
  exactly one guest row under a `LOWER()` match, via a scalar subquery with
  `ORDER BY g.created_at, g.id LIMIT 1`) is live in prod. LESSON from that review: a set-returning
  predicate under a unique index needs its own LIMIT — a `NOT EXISTS` guard only covers a
  PRE-EXISTING row, never multiple matches inside the same UPDATE.
- #709 closed — RESULT: merged as PR #721 (`9288601`); tiered Registrations tab live.
- #708 closed — RESULT: merged as PR #720 (`a11b89d`).
- #722 closed — RESULT: merged as PR #724 (`ef0c3e1`), E2E aborts on a dead dev server.

## Open items
- NOTED (not done, out of #713's scope): `app/api/calendar/feed-token/route.ts:21,45,81` and
  `app/api/profile/spouse-link/route.ts:138` still `await getBaseUrl()` unguarded. Neither commits
  irreversible state first, so neither has the #713 half-success shape — they just 500 on a
  misconfigured environment, which the Vercel fallback now prevents on previews. No ticket filed.
- NOTED (not done, same-class defect found by `/code-review medium` on #710): the case-sensitive
  email match fixed in the #710 RPC also exists in TypeScript at
  `lib/server/member-registration.ts:239` — `.eq('email', contactEmail)` in `attendEvent`'s D9
  adopt step. A member who signed up as `Ivan@Example.com` is not adopted and gets a second row.
  Fixing it needs either a citext/lower() index or a `.ilike()` lookup — its own ticket.
- **#726** `[2608-DEV-726]` `bug` (unclaimed, FILED 2026-08-11 from the #710 review): `EventPopup.tsx:156`'s
  `showMeta = activeTab !== 'registrations'` now applies to EVERY role, and
  `EventPopupShell.tsx:169-214` puts `AttendSection` + the share/QR buttons inside that gate. A
  member who opens the Registrations tab loses the Attend button with no affordance explaining why.
  A new regression from #721, not a carried one.
- **#727** `[2608-DEV-727]` `bug` `priority:high` (unclaimed, FILED 2026-08-11): a transient 401 while
  Clerk refreshes the session token makes `lib/apiClient.ts:29-33` set
  `window.location.href = '/sign-in'`, evicting a still-valid session. PROVED from the PR #725
  Playwright traces: a 5-endpoint 401 burst at t=180726ms right after `page.reload()`, then
  `200 GET /api/profile` 7ms later, then the `/sign-in` navigations. This — NOT leftover collapse
  state — is what makes `e2e/profile-bento-auth.spec.ts` intermittently red (`:72` and `:154`).
  Supersedes the earlier "order/state-dependent" note, which was a wrong diagnosis.
- **#718** `[2608-DEV-718]` `bug` (unclaimed): capacity-check TOCTOU race, same shape in
  `guest-registration.ts` and `member-registration.ts` — no DB-level guard on `guest_capacity`.
  #710 moved that read-then-write shape into the helper; it does NOT close the race.
- **#714** `[2608-DEV-714]` `chore` `priority:high` (docs mislabel the prod Supabase ref) and
  **#715** `[2608-DEV-715]` `bug` (sharer notifications: no `contact_email` fallback, no email cap)
  — both unclaimed, both from #706.
- NOTED (not done, out of scope — merged in #724): `e2e/server-watchdog-reporter.ts:57` calls
  `process.exit(1)`, which skips Playwright's `test.afterAll`. If the dev server dies during
  `e2e/event-registrations-auth.spec.ts`, its cleanup (`:164-171`) never runs and the seeded event,
  share links and registrations are orphaned in the shared DEV project.
- NOTED (not done, out of scope — merged in #721): `types/supabase.ts:2370` types the
  `get_event_registrations_for_viewer` returns `email`, `profile_id`, `sharer_name`, `attended_at`
  and `cancelled_at` as non-nullable `string`, but all five are NULL in normal operation. The
  current caller casts to `EventRegistration` (correctly nullable); the next caller that trusts the
  generated type dereferences a null with no compiler warning.
- NOTED (not done, found during #709): the DEV ledger has NO `20260809000100` row (#706
  `fn_schedule_guest_reminders_record`), though prod does. Function-body-only, so
  `types/supabase.ts` is unaffected, but hosted DEV may be running the pre-#706 body.
- NOTED (not done, declined CodeRabbit finding on #720, needs its own ticket): client error copy is
  selected by matching ENGLISH server text — `MemberAttendPanel.tsx:73-78` and
  `app/(dashboard)/calendar/components/EventPopup.tsx:76-78` both do `raw.includes('capacity')`.
  A real fix needs a machine-readable `code` on `attendEvent`'s failure result, through
  `app/api/events/[id]/attend/route.ts`, surfaced on `ApiError` (`lib/apiClient.ts:13`).
- NOTED (not done, found during #708): a signed-in member blocked by a FULL event still gets
  `ResendLinkForm` — the guest magic-link resend — at `app/events/[eventId]/register/page.tsx:179`
  and `:216`. Wrong flow for a portal identity; pre-existing blocked branch.
- NOTED (not done): `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`)
  still has the detached-anchor + synchronous-`revokeObjectURL` pattern fixed in
  `AddToCalendarMenu.tsx` — same latent no-file-downloaded bug in Firefox/Safari. Needs its own ticket.
- NOTED (not done): `docs/ai/REF.md` §6 Edge Functions table still lists `send-event-reminders`
  (does not exist) and omits `deliver-email-notifications`; §5's `guest_registrations` row is still
  the pre-#705 column list.
- CodeRabbit's "run member-share-register-auth serially" finding (#720) was DISPROVED, not deferred:
  `playwright.config.ts` never sets `fullyParallel`, so Playwright 1.61 parallelizes by FILE. Do not
  "fix" this later.

## Failed attempts
- ATTEMPT 1 [L1] (#709 GCR): adding an explicit `role="tab"` to the tab-bar buttons broke all 4
  `event-registrations-auth` specs — an explicit ARIA role OVERRIDES `<button>`'s implicit role, so
  `getByRole('button', …)` matched nothing. Lesson: adding an ARIA role is a REFERENCE SWEEP trigger
  for `getByRole` locators, not just for symbol renames.
