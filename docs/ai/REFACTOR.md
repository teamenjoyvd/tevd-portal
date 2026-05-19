{
  "branch": "main",
  "message": "[2605-DEV-427] docs: session 2 — correct T14, expand T12, add T17/T18/T19",
  "owner": "teamenjoyvd",
  "repo": "tevd-portal",
  "files": [
    {
      "path": "docs/ai/REFACTOR.md",
      "content": "# REFACTOR.md — Refactoring Knowledge Base

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

**Decision:** Active and correct. The word \"deprecated\" in the issue was a mischaracterisation.
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
285 bytes of noise. The comment says \"cannot delete via GitHub API\" — this is incorrect.
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

**Note (session 2):** Before promoting, inventory all client-side call sites that call this
PATCH endpoint. Any route split requires coordinated client-side updates. Do not CLAIM
without completing that audit — scope is unknown.

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
discarded. The JSDoc is explicit: \"fire-and-forget contract.\" The Resend call and audit
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

## Target 12 — Howtos redirect stubs (API + page routes)

**Status:** 📝 Notes captured

**Files read:** `app/api/howtos/route.ts`, `app/api/howtos/[slug]/route.ts`,
`app/api/admin/howtos/route.ts`, `app/api/admin/howtos/[id]/route.ts`,
`app/(dashboard)/howtos/page.tsx`

**Finding (updated session 2):** Original finding covered 4 API redirect stubs. Page-level
stubs also exist and were not in scope:
- `app/(dashboard)/howtos/page.tsx` — confirmed, redirects to `/guides`
- `app/(dashboard)/howtos/[slug]/page.tsx` — unread, structurally certain to match

Full deletion scope: 2 API files (`app/api/howtos/`), 2 admin API files
(`app/api/admin/howtos/`), 2+ page files (`app/(dashboard)/howtos/`) — 6+ files, plus the
`howtos` directory itself.

Page stubs create dead Next.js route segments: analysed at build time, included in the
bundle, and misleading in the file tree. Page stub deletion carries no external integration
risk (no external caller hits SSR page routes directly), unlike the API stubs.

Risk gate for API stubs: audit `teamenjoyvd/amway-price-checker` for `/api/howtos`
references before deleting. Page stubs can be deleted independently without that gate.

**Fix:** Two-step if needed — delete page stubs first (no gate), delete API stubs after
scraper audit clears. Or single commit if scraper audit passes.

**Promoted ticket:** _pending_ (API stubs blocked on scraper audit; page stubs unblocked)

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

## Target 14 — `app/(dashboard)/admin/layout.tsx`: admin role gate lacks explicit contract documentation

**Status:** 📝 Notes captured — ⚠️ Original finding corrected in session 2

**Files read:** `proxy.ts`, `app/(dashboard)/admin/layout.tsx`

**Finding (session 1 — incorrect):** Stated that `proxy.ts` left admin page routes without
role enforcement. The finding was wrong.

**Correction (session 2):** `app/(dashboard)/admin/layout.tsx` performs the role check:
```ts
const { data: profile } = await supabase
  .from('profiles').select('role').eq('clerk_id', userId).single()
if (profile?.role !== 'admin') redirect('/')
```
This runs on every admin page navigation via the RSC layout, using `createServiceClient()`
and redirecting non-admins to `/`. Enforcement is correctly placed at the layout layer —
middleware lacks clean Supabase access and the layout approach avoids adding a DB call to
every non-admin request.

**Residual risk:** Any admin page route segment that bypasses `(dashboard)/admin/layout.tsx`
via a separate route group would have no role check. No such segments exist in the current
file tree. The risk is theoretical, but real: nothing in the codebase makes it obvious that
the protection comes from layout hierarchy. A developer adding a new admin-adjacent route
group could silently bypass it.

**Fix:** Add a JSDoc/comment block to `admin/layout.tsx` explicitly documenting that this
layout is the sole auth+role gate for all `/admin/*` pages — not proxy.ts, not individual
page components. One-line comment, no logic change.

**Promoted ticket:** _pending_ (trivial — comment only)

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

## Target 17 — `app/api/trips/route.ts` GET: silent auth swallow + unscoped `select('*')`

**Status:** 📝 Notes captured

**Files read:** `app/api/trips/route.ts`

**Finding:** The GET handler determines the caller's role with a `try/catch` that silently
swallows all errors and falls back to `'guest'`:
```ts
try {
  const { userId } = await auth()
  if (userId) { /* fetch role */ }
} catch { /* unauthenticated — treat as guest */ }
```

The comment says \"unauthenticated — treat as guest\" but the catch block catches
*everything* — Clerk SDK failures, DB timeouts, profile-not-found. An authenticated user
whose Clerk call throws transiently will silently receive guest-filtered trips instead of
an error, with no visibility in logs.

Additionally, `.select('*')` on `trips` projects all columns into this semi-public response.
Any column added to `trips` in a future migration is immediately exposed to all authenticated
users regardless of role, with no stable response contract.

**Fix:** Separate the unauthenticated case (`!userId`, return early with `'guest'`) from
error cases (return 500). Add an explicit field projection replacing `select('*')`.

**Promoted ticket:** _pending_

---

## Target 18 — `app/api/notifications/[id]/route.ts`: untyped update shape + CRLF in read-all

**Status:** 📝 Notes captured

**Files read:** `app/api/notifications/[id]/route.ts`, `app/api/notifications/read-all/route.ts`

**Finding:** Two issues across the notifications write surface:

**Issue A — untyped update shape:** `PATCH /notifications/[id]` builds its update via:
```ts
const update: Record<string, unknown> = {}
if ('is_read' in body) update.is_read = body.is_read
if ('deleted_at' in body) update.deleted_at = body.deleted_at
```
The allowlist check is correct, but the `Record<string, unknown>` intermediate bypasses
TypeScript entirely. Values are not validated — `{ \"is_read\": \"yes\" }` passes the allowlist
and gets written to the DB. If a developer adds a field to the allowlist without type
narrowing, an arbitrary unvalidated value reaches Supabase.

**Issue B — CRLF line endings:** `app/api/notifications/read-all/route.ts` uses Windows
CRLF (`\\r\
`) line endings. Every other file in the codebase is LF. Signals the file was
created outside the normal toolchain. Creates noisy diffs.

**Fix Issue A:** Replace `Record<string, unknown>` with:
```ts
const update: Partial<{ is_read: boolean; deleted_at: string | null }> = {}
```
Add runtime type assertions before assignment.

**Fix Issue B:** Convert `read-all/route.ts` to LF.

**Promoted ticket:** _pending_

---

## Target 19 — `app/(dashboard)/howtos/*` page stubs (merged into Target 12)

**Status:** Merged into Target 12 — see updated scope there.

`app/(dashboard)/howtos/page.tsx` confirmed as a redirect stub (→ `/guides`).
`app/(dashboard)/howtos/[slug]/page.tsx` unread but structurally certain to match.
Page stubs carry no external integration risk and can be deleted without the scraper audit
gate. No standalone ticket — included in Target 12.

---

## Session log

### Session 1 — 2026-05-18

**Mode:** PLAN
**Targets assessed:** 1–16
**Files read:** 25+
**Outcomes:**
- Targets 1, 3, 7, 8: ❌ Won't fix
- Target 10: 📝 Blocked on test infrastructure
- Target 12: 📝 Blocked on scraper (`amway-price-checker`) audit
- Targets 2, 4, 5, 6, 9, 11, 13, 14, 15, 16: 📝 Notes captured

### Session 2 — 2026-05-18

**Mode:** PLAN
**Targets assessed:** 1–19 (full review + corrections)
**Files read:** `proxy.ts`, `app/(dashboard)/admin/layout.tsx`, `app/api/trips/route.ts`,
`app/api/notifications/route.ts`, `app/api/notifications/[id]/route.ts`,
`app/api/notifications/read-all/route.ts`, `app/(dashboard)/howtos/page.tsx`
**Outcomes:**
- Target 14: Original finding incorrect. Revised — `admin/layout.tsx` is the correct
  enforcement point. Fix downgraded to comment-only.
- Target 12: Scope expanded to include page stubs. Page stubs unblocked from scraper gate.
- Target 5: CLAIM blocked until client call-site audit completed.
- Targets 17, 18: 📝 New, notes captured, ready to promote.
- Target 19: Merged into Target 12.

**Revised priority order (risk-adjusted):**
1. Target 9 — send-event-reminders idempotency (double-send to real users)
2. Target 16 — los-import unbounded snapshot (OOM on large imports)
3. Target 11 — deprecated guard sweep (hygiene, large surface)
4. Target 13 — payments POST dynamic import chain (trivial, high signal/noise)
5. Target 17 — trips GET silent swallow + select * (low severity, easy)
6. Target 4 — BottomNav dead stub (trivial delete)
7. Target 14 — admin/layout.tsx JSDoc comment (trivial)
8. Target 18 — notifications untyped update + CRLF (low severity)
9. Targets 2, 6, 12, 15 — remaining
10. Target 5 — after client call-site audit
"
    }
  ]
}
