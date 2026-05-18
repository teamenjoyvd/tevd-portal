# REFACTOR.md — Refactoring Knowledge Base
> Anchor issue: #427
> This file is the source of truth. The GitHub issue is the pointer.
> Updated by Claude at the end of each gathering session via push_files on a branch.

---

## How this works

Each session that works on this file:
1. Reads this file in full at session start
2. Picks one or more targets marked 🔍 or 📖
3. Reads the actual source files for those targets
4. Captures findings in the relevant target section below
5. Updates the status and commits the file on a branch
6. Adds a comment to issue #427 summarising what changed

A target is promoted to a BUILD ticket when its section contains:
- Confirmed scope (exact files affected)
- Confirmed approach (what changes, what doesn't)
- Confirmed gotchas checked against `docs/ai/GOTCHAS.md`
- No blocking unknowns

---

## Status legend

| Icon | Meaning |
|---|---|
| 🔍 Initial assessment | Identified, not yet file-read |
| 📖 Reading in progress | Files being read this session |
| 📝 Notes captured | File reads done, findings below |
| ✅ Ticket ready | CLAIM-ready issue created — see Promoted Tickets |
| ❌ Won't fix | Decided not to act — reason recorded below |

---

## Promoted Tickets

_None yet._

---

## Target 1 — `lib/supabase/service.ts` fresh client per call

**Status:** 🔍 Initial assessment  
**Risk class:** Performance  

### Initial assessment
`createServiceClient()` returns a new `createClient` instance on every call. The module-level singleton was removed in PR #307 to prevent auth-header contamination across warm Lambda requests — correct reasoning. But the current solution overcorrects: a new PostgREST HTTP client on every route handler invocation means no connection reuse and re-initialisation overhead on every request.

### Files to read
- `lib/supabase/service.ts`
- One representative route handler that calls `createServiceClient()` multiple times

### Open questions
- Does Next.js `cache()` from `react` work here as a request-scoped singleton, or does the Supabase client hold mutable state that makes caching unsafe?
- How many times is `createServiceClient()` called per request in the hot paths (e.g. `/api/admin/members`)?

### Findings
_Not yet read._

---

## Target 2 — `payments` PostgREST FK join footgun

**Status:** 🔍 Initial assessment  
**Risk class:** Correctness  

### Initial assessment
`payments` has two FKs to `profiles` (`profile_id` and presumably a second). PostgREST requires an explicit hint (`profiles!profile_id(...)`) to resolve the ambiguous join. This is a manual discipline requirement with no enforcement — any query author who omits the hint gets a runtime error or wrong data.

### Files to read
- All API routes that SELECT from `payments` with a join to `profiles`
- `types/supabase.ts` — confirm the two FK columns

### Open questions
- Is there already a `v_payments` view or similar? If yes, is it used consistently?
- Which routes are the actual bug-risk sites right now?

### Findings
_Not yet read._

---

## Target 3 — Deprecated `approve_member_verification` RPC

**Status:** 🔍 Initial assessment  
**Risk class:** Safety / confusion  

### Initial assessment
The RPC exists in the DB as a SECURITY DEFINER function. Its logic was moved to Inngest Step 1. It's documented as "retained as fallback only" — which in practice means it will be called under pressure or by mistake. It should either be dropped or have its body replaced with `RAISE EXCEPTION` to force a conscious decision.

### Files to read
- `supabase/migrations/` — find the migration that created the RPC and any that modified it
- `inngest/functions/approve-verification.ts` — confirm Step 1 fully covers the RPC's original logic
- `app/api/admin/verify/route.ts` — confirm it calls Inngest, not the RPC directly

### Open questions
- Are there any non-Inngest call sites that still reference the RPC?
- Is dropping it safe, or does any edge function / pg_cron job reference it?

### Findings
_Not yet read._

---

## Target 4 — `components/layout/BottomNav.tsx` dead stub

**Status:** 🔍 Initial assessment  
**Risk class:** Code health  

### Initial assessment
Documented as "DEAD STUB — do not import." Still exists in the component tree. Will be imported by someone who doesn't read the comment. Straightforward delete.

### Files to read
- `components/layout/BottomNav.tsx` — confirm it has no active imports
- `grep` across codebase for any `import.*BottomNav`

### Open questions
- Any import anywhere? If yes, that import is the real bug.

### Findings
_Not yet read._

---

## Target 5 — `PATCH /api/admin/members/[id]` action discriminator

**Status:** 🔍 Initial assessment  
**Risk class:** API design  

### Initial assessment
One PATCH handler handles three semantically distinct operations: standard field update, `action: 'promote_to_primary'`, and `action: 'dissolve_partnership'`. The latter two are irreversible state machine transitions backed by a SECURITY DEFINER RPC. They should be explicit POST routes.

### Files to read
- `app/api/admin/members/[id]/route.ts` — full handler
- `supabase/migrations/` — `promote_to_primary` RPC definition

### Open questions
- Are there any client call sites that would need updating if the routes change?
- Is `dissolve_partnership` an RPC too, or inline SQL in the route?

### Findings
_Not yet read._

---

## Target 6 — `abo_number` null invariant not reflected in TypeScript types

**Status:** 🔍 Initial assessment  
**Risk class:** Type safety  

### Initial assessment
The invariant (NULL illegal for `member`/`core` with no `primary_profile_id`) is DB-enforced via `trg_guard_abo_number_null`. But `types/supabase.ts` represents `abo_number` as `string | null` everywhere. Application code duplicates invariant logic. A discriminated union at the TypeScript layer would catch member-specific paths reached with null ABO.

### Files to read
- `types/supabase.ts` — `profiles` row type
- One or two call sites where `abo_number` null-checks are performed in application code

### Open questions
- How many distinct places in the codebase branch on `abo_number` presence?
- Is there a shared `Profile` type in application code, or is the raw Supabase type used directly everywhere?

### Findings
_Not yet read._

---

## Target 7 — `sendNotificationEmail` silent failure

**Status:** 🔍 Initial assessment  
**Risk class:** Observability  

### Initial assessment
`sendNotificationEmail` is fire-and-forget — errors swallowed to `email_log`. Several call sites are in admin-triggered flows (approve registration, approve payment) where silent failure is a UX problem. The function should return a discriminated result; routes should log a structured warning on failure.

### Files to read
- `lib/email/send.ts` — both dispatchers in full
- 2–3 representative call sites (payment approval, registration approval)

### Open questions
- Does `sendTransactionalEmail` already return a discriminated result? (REF.md says yes — confirm in code)
- What does the `email_log` record look like on a swallowed error — is it actually useful for debugging today?

### Findings
_Not yet read._

---

## Target 8 — `lib/og-scrape.ts` missing `server-only` guard

**Status:** 🔍 Initial assessment  
**Risk class:** Boundary enforcement  

### Initial assessment
No `import 'server-only'` guard. Any client component that accidentally imports it gets either a runtime crash or silent nulls. Additionally, null returns for IG/FB URLs are indistinguishable from network failures — should be a typed result.

### Files to read
- `lib/og-scrape.ts` — full file
- `app/api/admin/social-posts/preview/route.ts` — the only documented consumer

### Open questions
- Are there any other import sites beyond the preview route?
- Is `server-only` already in `package.json`? (It's a Next.js package — likely yes.)

### Findings
_Not yet read._

---

## Target 9 — `send-event-reminders` edge function idempotency

**Status:** 🔍 Initial assessment  
**Risk class:** Data integrity  

### Initial assessment
pg_cron fires every 5 min. If the edge function runs longer than 5 min, two invocations overlap and both attempt to send the same reminder. The schema has the right structure (`UNIQUE (registration_id, reminder_type)`, partial index on `send_at WHERE sent_at IS NULL`) but whether the function uses `SELECT ... FOR UPDATE SKIP LOCKED` is undocumented.

### Files to read
- `supabase/functions/send-event-reminders/index.ts` — full function
- Migration that created `scheduled_reminders` + the pg_cron job definition

### Open questions
- Does the function use `FOR UPDATE SKIP LOCKED`? If not, does the UNIQUE constraint on the `sent_at` update provide sufficient protection?
- What is the observed p95 execution time? Is the 5-min overlap actually a realistic risk?

### Findings
_Not yet read._

---

## Target 10 — `proxy.ts` public route list, no test coverage

**Status:** 🔍 Initial assessment  
**Risk class:** Security posture  

### Initial assessment
`proxy.ts` carries a growing public route list. No automated test verifies that a newly added route is intentionally public vs. accidentally unprotected. A route that should require auth silently passes through if its prefix matches the public list. Fix: typed public route registry + a test that enumerates all `/api` routes and asserts each is either explicitly public or provably auth-gated.

### Files to read
- `proxy.ts` — full file
- `.github/workflows/check-types.yml` — understand current CI surface to know where a new test would live

### Open questions
- Is there a test infrastructure at all (Jest, Vitest)? If not, this ticket may depend on first establishing one.
- What is the mechanism for marking a route public — string prefix match, exact match, regex?

### Findings
_Not yet read._