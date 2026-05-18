# REFACTOR.md — Refactoring Knowledge Base

Living document. Each entry is a refactoring candidate identified through code reading.
Do not edit findings retroactively — append new sessions at the bottom of each entry.

Source issue: [#427 — Refactoring knowledge base — living document](https://github.com/teamenjoyvd/tevd-portal/issues/427)

---

## Status legend

| Icon | Meaning |
|---|---|
| 🔍 Initial assessment | Identified, not yet file-read |
| 📝 Notes captured | File reads done, findings recorded here |
| ✅ Ticket ready | CLAIM-ready issue created, linked below |
| ❌ Won't fix | Decided not to act — reason recorded |

---

## Target 1 — `lib/supabase/service.ts`: fresh client per call

**Status:** ❌ Won't fix

**Files read:** `lib/supabase/service.ts`

**Finding:** The comment is accurate and the reasoning is sound. The service role client carries
no user-session state — it's a URL + key pair. Creating a fresh client per call costs
~microseconds (object instantiation, no network). The stated concern about auth-header
contamination across warm lambda requests is the correct reason to avoid a module-level
singleton here. The pattern is intentional and correct.

**Decision:** Correct by design. No action.

---

## Target 2 — `payments` FK join footgun

**Status:** 📝 Notes captured

**Files read:** `app/api/admin/members/[id]/route.ts`, `app/api/profile/payments/route.ts`

**Finding:** Both routes use PostgREST implicit FK join syntax:
- `admin/members/[id]`: `.select('*, trip:trips(title), item:payable_items(title)')`
- `profile/payments`: `.select('... trips(title), payable_items(title)')`

The `payments` table has two FK columns — `trip_id` (→ trips) and `payable_item_id`
(→ payable_items), which are mutually exclusive. PostgREST resolves via constraint name,
but the current selects use table-name shorthand, which relies on PostgREST inferring the
correct FK. Safe today (one FK to each table), but fragile:

1. If a second FK to `trips` is ever added, PostgREST will throw an ambiguous FK error
   at runtime with no compile-time warning.
2. The route handler casts join results via `as { title: string } | null`, bypassing
   TypeScript's generated types entirely.

**Fix:** Use explicit constraint-name hint syntax in both routes (e.g. `trips!trip_id(title)`).
Replace `as` casts with properly typed variables.

**Promoted ticket:** _pending_

---

## Target 3 — Deprecated `approve_member_verification` RPC

**Status:** ❌ Won't fix

**Files read:** `supabase/migrations/20260401000000_approve_member_verification_rpc.sql`
through `20260510_001_fix_approve_rpc_ambiguous_column.sql`

**Finding:** The RPC is not deprecated — it is the live, actively called function as of
`20260510_001`. Current version is correct: SECURITY DEFINER, proper `search_path`,
idempotency guard with 23505, LOS existence + sponsor mismatch guards, duplicate ABO guard,
tree node upsert, qualified column references to avoid planner ambiguity. The route in
`verify/[id]/route.ts` calls it correctly.

**Decision:** Active and correct. The word "deprecated" in the issue was a mischaracterisation.
No action.

---

## Target 4 — `components/layout/BottomNav.tsx` dead stub

**Status:** 📝 Notes captured

**Files read:** `components/layout/BottomNav.tsx`

**Finding:** File content:
```ts
// DEAD FILE — ISS-0138
// BottomNav was removed in ISS-0137. This file is intentionally empty.
export {}
```
285 bytes of noise. The comment says "cannot delete via GitHub API" — this is incorrect.
Deletion is possible via the GitHub API using a DELETE request with the blob SHA, or via
`push_files` with an empty replacement followed by a deletion commit. No imports point at it
(`export {}` emits nothing importable).

**Fix:** Delete the file in a single-file BUILD commit.

**Promoted ticket:** _pending_

---

## Target 5 — `PATCH /api/admin/members/[id]` action discriminator

**Status:** 📝 Notes captured

**Files read:** `app/api/admin/members/[id]/route.ts`

**Finding:** The PATCH handler uses a sequential `if (body.action === '...')` discriminator
with three action branches plus a fallthrough standard field patch. Issues:

1. No exhaustive type check — unknown `body.action` silently falls through to standard
   patch, which returns a confusing 400.
2. The role downgrade guard (secondary check before `role === 'guest'`) sits in the
   standard patch path. A future action branch that sets `body.role = 'guest'` would
   bypass this guard.
3. `promote_to_primary` calls `rebuild_tree_paths` (high blast radius) — no per-action
   authorization differentiation, all admin-gated is fine but asymmetry is undocumented.

**Fix:** Split high-blast-radius actions into dedicated routes
(`POST /api/admin/members/[id]/promote`, `POST /api/admin/members/[id]/dissolve`).
Not a pure discriminator refactor — a route decomposition.

**Promoted ticket:** _pending_

---

## Target 6 — `abo_number` null invariant in TypeScript

**Status:** 📝 Notes captured

**Files read:** `app/api/admin/members/[id]/route.ts`, `lib/los.ts`

**Finding:** In `admin/members/[id]/route.ts`:
```ts
const aboNumber = profileRes.data?.abo_number ?? ''
// then:
supabase.from('los_members').select('*').eq('abo_number', aboNumber)
```
If the profile has no `abo_number` (guest, manual-verified member, secondary profile),
`aboNumber` is `''`. The query runs and returns zero rows — semantically correct result,
but unnecessary DB work (searching `abo_number = ''` will never match real data).

The TypeScript type on `profiles.abo_number` is `string | null` but the code collapses
it to `''` without branching. The `los_members` query should be skipped entirely when
`abo_number` is null.

**Fix:** Guard the `los_members` query: `if (aboNumber) { ... }` — skip when null/empty.

**Promoted ticket:** _pending_

---

## Target 7 — `sendNotificationEmail` silent failure

**Status:** ❌ Won't fix

**Files read:** `lib/email/send.ts`

**Finding:** `sendNotificationEmail` returns `Promise<void>` with the result intentionally
discarded. The JSDoc is explicit: "fire-and-forget contract." The Resend call and audit
log write happen inside `_dispatch` which catches all errors and writes them to `email_log`.
Silent failure at the caller is the correct contract for notification emails.

The payments POST call site (`app/api/profile/payments/route.ts`) is the real smell —
see Target 13.

**Decision:** Correct by design on `sendNotificationEmail` itself. No action here.

---

## Target 8 — `lib/og-scrape.ts` missing `server-only` guard

**Status:** ❌ Won't fix

**Files read:** `lib/og-scrape.ts`

**Finding:** Line 2 of the file: `import 'server-only'`. Guard is already present.
This target was identified before the file was read.

**Decision:** Already correct. No action.

---

## Target 9 — `send-event-reminders` idempotency unverified

**Status:** 📝 Notes captured

**Files read:** `supabase/functions/send-event-reminders/index.ts`

**Finding:** Partial idempotency — the function fetches `.is('sent_at', null)` and only
updates `sent_at` after a successful Resend call. However, there is no row-level lock
during processing. If two invocations overlap (cron scheduler drift, cold-start delay),
both can fetch the same `sent_at IS NULL` rows, both send the email, and both write
`sent_at`. The second write is a no-op but the email is doubled.

The standard fix for exactly-once job processing: claim rows atomically using
`SELECT ... FOR UPDATE SKIP LOCKED` before sending. This is not possible in PostgREST
client SDK — requires a Postgres function or a raw SQL query from the edge function.

Additionally: if the `email_log` insert fails after a successful Resend call, that error
is silently swallowed.

**Fix:** Add `FOR UPDATE SKIP LOCKED` claim step, or move the reminder dispatch into a
Postgres function that atomically claims + marks `sent_at = now()` before delegating to
Resend. This requires a migration.

**Promoted ticket:** _pending_

---

## Target 10 — `lib/public-routes.ts` — no test coverage

**Status:** 📝 Notes captured

**Files read:** `lib/public-routes.ts`

**Finding:** The file is clean — consolidated, `as const`, single source of truth.
No tests verify that:
1. Every intended public route is in the list (regression: new public route added
   without updating this file → 307 redirect for logged-out users).
2. No unintended route is public (security regression).

No test infrastructure visible in the repo (`__tests__/`, `vitest.config.*`,
`jest.config.*` absent from directory scan). Adding tests requires setting up a test
runner first — that is a prerequisite.

**Decision:** Blocked on test infrastructure. Will not promote until a test setup exists.

---

## Target 11 — `requireAdmin` / `requireAdminOrCore` deprecated callers still in production

**Status:** 📝 Notes captured

**Files read:** `lib/supabase/guards.ts`, `app/api/admin/members/verify/[id]/route.ts`,
`app/api/admin/los-import/route.ts`

**Finding:** `guards.ts` marks `requireAdmin` and `requireAdminOrCore` as `@deprecated`
since `getCallerContext` was introduced. Confirmed callers still using the deprecated API:
- `app/api/admin/los-import/route.ts` — both GET and POST use `requireAdmin`
- `app/api/admin/members/verify/[id]/route.ts` — rolls its own inline check (third
  pattern, not even `requireAdmin`):
  ```ts
  const { data: admin } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (admin?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
  ```
  This discards the profile immediately, then re-fetches `profiles` inside the approve
  branch — two DB round trips where `getCallerContext` would give one.

Scope: audit all admin routes — estimate 15-20 files touch `requireAdmin`.

**Fix:** Mechanical sweep — replace all `requireAdmin`/`requireAdminOrCore` calls and
inline role checks with `getCallerContext`. Delete the deprecated exports from `guards.ts`
once callers are migrated.

**Promoted ticket:** _pending_

---

## Target 12 — `app/api/howtos` and `app/api/admin/howtos` redirect stubs

**Status:** 📝 Notes captured

**Files read:** `app/api/howtos/route.ts`, `app/api/howtos/[slug]/route.ts`,
`app/api/admin/howtos/route.ts`, `app/api/admin/howtos/[id]/route.ts`

**Finding:** Four route files exist solely to 308-redirect to their `/guides` equivalents,
left over from ISS-0144 (the `/guides` rename). Correct transitional hygiene, but
should have a sunset date.

Risk of premature deletion: any hardcoded `/api/howtos/...` URL in the mobile app,
Amway scraper, or external integrations would hard-break. The `teamenjoyvd/amway-price-checker`
rep is a separate repo and must be audited before deletion.

From what is visible in `tevd-portal`, no dashboard component references `/api/howtos`.
The redirect stubs are likely safe to delete, but the scraper audit is the gate.

**Fix:** Read `teamenjoyvd/amway-price-checker` for any `/api/howtos` references.
If none found → delete all four files in a single commit.

**Promoted ticket:** _pending_ (blocked on scraper audit)

---

## Target 13 — `app/api/profile/payments` POST: deeply nested dynamic import chain

**Status:** 📝 Notes captured

**Files read:** `app/api/profile/payments/route.ts`

**Finding:** The POST handler sends an admin alert via four levels of nested dynamic
imports chained with `.catch(console.error)`:
```ts
import('@/lib/email/send').then(({ sendNotificationEmail, getEmailConfig }) => {
  getEmailConfig().then(config => {
    import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
      import('@/lib/email/templates/PaymentSubmittedEmail').then(({ PaymentSubmittedEmail }) => {
        // ...
      }).catch(console.error)
    }).catch(console.error)
  }).catch(console.error)
}).catch(console.error)
```

Problems:
1. Dynamic imports are unnecessary — these are server-side modules, statically importable.
   The fire-and-forget semantics come from not `await`-ing, not from dynamic import.
2. The nesting hides errors — each `.catch` independently swallows failures; no way to
   distinguish which layer failed from logs.
3. The `payment_status` notification-type toggle is enforced inside `sendNotificationEmail`,
   but invisible in this call site.

**Fix:** Move imports to top of file. Extract:
```ts
async function sendPaymentAlert(...) { ... } // one try/catch, flat
// called without await — fire-and-forget preserved
void sendPaymentAlert(...)
```

**Promoted ticket:** _pending_

---

## Target 14 — `proxy.ts` admin page routes have no role enforcement

**Status:** 📝 Notes captured

**Files read:** `proxy.ts`

**Finding:** The middleware confirms authenticated users for `/admin/*` page routes but
does not confirm admin role:
```ts
if (isAdminPageRoute(req)) return  // authenticated — but role unchecked
```
For `/api/admin/*` route handlers, `getCallerContext` enforces role at the handler layer.
For `/admin/*` page routes, a `member`-role user who knows the URL can navigate to
`/admin/members` and receive a full RSC render. Whether this is an active exploit depends
on whether every admin RSC page independently checks role before fetching data.

This is one missed role check in any admin RSC page away from a data leak.

**Fix:** Add a Supabase role check in `proxy.ts` for `isAdminPageRoute` and redirect
non-admins to `/`. One extra DB call per admin page navigation (not per request — cached
by the request lifecycle).

**Promoted ticket:** _pending_

---

## Target 15 — `lib/supabase/rpc.ts`: `as unknown as` cast hides generated-type drift risk

**Status:** 📝 Notes captured

**Files read:** `lib/supabase/rpc.ts`

**Finding:** The `upsertTreeNode` helper bridges a gap between generated Supabase types
(which declare `p_abo_number` as `string`) and the actual RPC (which accepts `string | null`)
via a double cast:
```ts
.rpc('upsert_tree_node', args as unknown as Parameters<typeof supabase.rpc<'upsert_tree_node'>>[1])
```
`as unknown as T` bypasses all type safety. If the generated types for `upsert_tree_node`
change (new parameter added, renamed), this cast silently compiles while passing the wrong
shape to the DB at runtime.

**Fix:** Define a local override type that precisely describes the actual RPC args
(including the nullable `p_abo_number`) and cast only to that — not to `Parameters<...>`.
Alternatively, regenerate `types/supabase.ts` with the correct nullable signature if
the Supabase codegen supports it.

**Promoted ticket:** _pending_

---

## Target 16 — `app/api/admin/los-import/route.ts`: deprecated guard + unbounded snapshot query

**Status:** 📝 Notes captured

**Files read:** `app/api/admin/los-import/route.ts`

**Finding:** Two distinct issues:

**Issue A — deprecated guard:** Both GET and POST use `requireAdmin` (confirmed live
caller). Mechanical swap to `getCallerContext` (same as Target 11 sweep).

**Issue B — unbounded snapshot query (more serious):** The POST handler snapshots the
entire `los_members` table before the RPC runs:
```ts
const { data: snapshot } = await supabase
  .from('los_members')
  .select('abo_number, abo_level, bonus_percent, name')
// no .limit()
```
For a 10,000-row LOS, this fetches all rows into the Next.js lambda's memory, builds a
Map, then iterates the incoming rows array to compute a diff. The lambda has a 4MB
response limit and a memory ceiling — a large enough LOS will OOM or timeout.

**Fix:** Move diff computation into the RPC (Postgres is the right place for set operations
on large tables). At minimum, scope the snapshot to incoming ABOs only:
`.in('abo_number', incomingAbos)` where `incomingAbos` is extracted before the query.

This is a standalone BUILD ticket — the unbounded query is the primary concern; the guard
swap is a free rider.

**Promoted ticket:** _pending_

---

## Session log

### Session 1 — 2026-05-18

**Mode:** PLAN
**Targets assessed:** 1–16
**Files read:** 25+
**Outcomes:**
- Targets 1, 3, 7, 8: ❌ Won't fix
- Targets 10: 📝 Blocked on test infrastructure
- Targets 12: 📝 Blocked on scraper (`amway-price-checker`) audit
- Targets 2, 4, 5, 6, 9, 11, 13, 14, 15, 16: 📝 Ready to promote to BUILD tickets

**Next session:** CLAIM each actionable target into a numbered GitHub issue.
Priority order (risk-adjusted):
1. Target 14 — proxy admin page role enforcement (security)
2. Target 9 — send-event-reminders idempotency (data integrity)
3. Target 16 — los-import unbounded snapshot (reliability)
4. Target 11 — deprecated guard sweep (hygiene, large surface)
5. Target 13 — payments POST dynamic import chain (trivial)
6. Target 4 — BottomNav delete (trivial)
7. Targets 2, 5, 6, 12, 15 — remaining
