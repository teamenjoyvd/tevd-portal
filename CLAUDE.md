# CLAUDE.md — teamenjoyVD Portal
> Last updated: 2026-03-26 — v2.0.5. Latest stable commit: 2f7f0fd.
> Architecture docs live in `docs/architecture/`. Reference tables live in `docs/ai/LOOKUP.md`. Orienting context in `docs/ai/CONTEXT.md`.
> **Neither CONTEXT.md nor LOOKUP.md is read at SSU. Read specific sections in GATHER/SHAPE only.**

---

## 0. Commands

| Command | What it does |
|---|---|
| **SSU** | System Status Update — checks all connections, confirms session is ready |
| **PIU** | Pack It Up — session handover, updates docs |

---

## SSU — System Status Update

When the user types **SSU**, execute in full, in order:

1. **Airtable** — `list_bases`. Confirm `app1n7KYX8i8xSiB7` reachable. ✅/❌
2. **GitHub MCP** — `get_file_contents` on `CLAUDE.md` from repo `teamenjoyvd/tevd-portal`. Confirm loaded. ✅/❌
3. **Vercel** — `list_deployments`. Confirm latest production deployment is READY. ✅/❌
4. **Supabase** — `list_projects`. Confirm `ynykjpnetfwqzdnsgkkg` is `ACTIVE_HEALTHY`. ✅/❌
5. **Queue** — check Issues for `Status = "In Progress"` AND `Duplicate = false/empty`. If found, report it. Else report highest-priority unblocked `Status = "To Do"` AND `Duplicate = false/empty` ticket.

```
## SSU Report
| Connection  | Status | Notes |
|-------------|--------|-------|
| Airtable    | ✅/❌  | ...   |
| GitHub MCP  | ✅/❌  | ...   |
| Vercel      | ✅/❌  | ...   |
| Supabase    | ✅/❌  | ...   |
| Queue       | —      | SEQ<NNN>-ISS<NNN>: ... / All clear |
```

If any ❌ — stop. Do not proceed to task work.

---

## PIU — Pack It Up

1. Update CLAUDE.md header (stable commit, date).
2. Update `docs/ai/CONTEXT.md` — new routes, new release entry, pending issues.
3. Update `docs/ai/LOOKUP.md` — schema changes, new env vars, new API routes.
4. Update `docs/architecture/` — if session introduced a new flow, new external system, or new architectural decision.
5. Update Gotchas below if new non-obvious decisions were made this session.
6. Verify latest commit is pushed and Vercel deployment is READY.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.1.6 App Router + React 19 | Turbopack enabled |
| Auth | Clerk @7 | `clerkMiddleware` + `createRouteMatcher` in `proxy.ts`. `await auth()` → `{ userId }`. No JWT template. |
| Database | Supabase (PostgreSQL 17) | RLS on all tables. LTree, pg_cron, pg_net. Project: `ynykjpnetfwqzdnsgkkg`. |
| State | TanStack Query v5 | `QueryClientProvider` in `app/providers.tsx`. |
| Styling | Tailwind CSS v4 | No `@layer` + `@apply`. Inline utilities only. Exceptions: `globals.css`, `styles/brand-tokens.css`. |
| Maps | Mapbox GL JS v2.15.0 | CDN only — never npm. Token: `NEXT_PUBLIC_MAPBOX_TOKEN`. |
| Middleware | `proxy.ts` | **NEVER create `middleware.ts`.** |
| Deployment | Vercel | Team: `teamenjoyvd`. Project: `prj_HFZJZg2vkLtpX8XvjJlo3mDkSCyn`. |
| Repo | `teamenjoyvd/tevd-portal` | Private, `main` only. Never ask user for repo — always use this. |
| Production | `https://tevd-portal.vercel.app` | |

---

## 2. Hard Constraints

Violation = immediate stop.

- **NEVER create `middleware.ts`.** Use `proxy.ts`.
- **NEVER bypass Clerk auth on a protected route.** Security violation.
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** Server-only.
- **NEVER write `Status=Done` before the commit link exists.** Finalization is atomic.
- **NEVER proceed past CLAIM if `Blocked By` is non-empty** without explicit acknowledgment.
- **NEVER mark Done on static analysis alone.** Verify Vercel deployment is READY AND CI passes.
- **390px Mobile-First:** Every new UI surface must render correctly at 390px. The layout law below is non-negotiable.
- **RLS policies MUST use Pattern A helper functions** (`is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`). Never use raw `auth.jwt() ->> 'sub'` or `auth.jwt() ->> 'user_role'` directly. See ADR-011 in `docs/architecture/DECISIONS.md`.

### Desktop / Mobile Layout Law

Two separate complete layouts. No hybrid responsive design. Pattern:
```tsx
<div className="hidden md:block">{/* Desktop */}</div>
<div className="md:hidden">{/* Mobile */}</div>
```
Prohibitions: no BottomNav, no tab bar, no FAB, no `overflow-x-auto` on nav.

**Canonical reference:** `app/(dashboard)/about/page.tsx`

---

## 3. Workflow Loop — Airtable → GitHub

Declare phase at opening of every work response: `PHASE: READ | SHAPE | CLAIM | GATHER | EXECUTE | VERIFY | FINALIZE`

**Issue numbering:** `SEQ<NNN>-ISS<NNN>` — e.g. `SEQ116-ISS107`. Always use this format in reports, commit messages, and notes.

**READ:** Query `Status = "In Progress"` AND `Duplicate = false/empty`. Resume if found. Else query `Status = "To Do"` AND `Blocked By = empty` AND `Duplicate = false/empty`, sorted by Priority asc. Probe vague/harmful tickets before claiming.

**SHAPE:** Before claiming, locate the ticket in the architecture docs. Hard stop on each trigger:
- Ticket touches auth, role, Clerk sync → read `FLOWS.md §1`
- Ticket touches registration status → read `FLOWS.md §2`
- Ticket touches payments → read `FLOWS.md §3`
- Ticket touches LOS, tree, notifications → read `FLOWS.md §4`
- Ticket touches vital signs → read `FLOWS.md §5` (pending SO clarification — do not proceed without it)
- Ticket introduces a new external dependency → update `C4.md` first
- Ticket introduces a new architectural pattern or library → write ADR in `DECISIONS.md` before EXECUTE
- DoD still vague after this check → probe before claiming

**CLAIM:** Set `Status = "In Progress"` by **Seq** (not Issue ID). Gate: Blocked By empty + Duplicate false.

**GATHER:** Read `docs/ai/CONTEXT.md` first. Then pull from `docs/ai/LOOKUP.md` only for sections the ticket needs (see section map in CONTEXT.md header).

**EXECUTE:** Write code. Zero-Refactor Rule: change only lines required by DoD.

**VERIFY:** DoD point-by-point. Check Vercel deployment is READY and CI is green. Iterate if gaps remain.

**FINALIZE:** Commit `[SEQ<NNN>-ISS<NNN>] Short imperative description`. Single Airtable write: `Status=Done` + `CommitLink` + `ClaudeNotes`.

### Airtable Reference

**Base:** `app1n7KYX8i8xSiB7` — **Issues Table:** `tblUq45Wo3xngSf3w`
→ Field IDs and Status choice IDs: see `docs/ai/LOOKUP.md §7`
Duplicate-safe: always filter `Duplicate = false/empty`; discard `fld2P6m5fMOsi1q3G === true` if MCP can't filter checkboxes.

---

## 4. Code Style

- Zero-Refactor Rule: change only lines required by the DoD. Never re-indent, rename, or reformat untouched sections.
- No `any` — use `unknown` and narrow.
- No `console.log` in committed code.
- No default exports from utility files.
- No barrel `index.ts` unless one already exists.
- Explicit return types on route handlers and server actions.
- `<img>` for user-uploaded images (domains unpredictable).
- `TranslationKey` is strict — add to `lib/i18n/translations.ts` before using `t()` or build breaks.
- `useParams()` takes NO type argument in Next.js 16. Use `const params = useParams(); const id = params.id as string`.

---

## 5. Gotchas (non-derivable decisions)

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| Mapbox | CDN only. Dupe guard on load. Logo/attribution hidden via globals.css. |
| Mapbox theme swap | `map.setStyle()` + `styledata` event. MutationObserver on `data-theme`. |
| Mapbox About tile style | `outdoors-v12` (light) / `dark-v11` (dark). |
| Clerk shadow DOM | CSS vars unavailable. Use hardcoded hex (`#bc4749`). |
| Clerk v7 auth | `await auth()` → `{ userId }`. No sync auth. No JWT template. |
| Role promotion | Every `profiles.role` update MUST also call `clerk.users.updateUserMetadata`. Routes: `/api/admin/verify`, `/api/admin/members/[id]` PATCH, `/api/admin/members/verify/[id]`. Pre-fix cohort (before commit 4b2d69c) has stale metadata — re-login to fix. |
| `useLanguage` | Dispatches `window.dispatchEvent(new Event('language-changed'))` on toggle. |
| Profile page prerender | `/profile` prerenders. Guard ALL `validProfile!` accesses with `if (isLoading \|\| !validProfile) return <ProfileSkeleton />` before any JSX referencing profile fields. |
| Seq is the true PK | `Issue ID` is NOT unique. `Seq` (autonumber) is the PK. Always target by Seq. Issue format: `SEQ<NNN>-ISS<NNN>`. Commit format: `[SEQ<NNN>-ISS<NNN>] Description`. |
| `types/supabase.ts` | Always regenerate via `Supabase:generate_typescript_types` MCP tool after migrations — NOT the CLI. |
| `supabase gen types` CLI | NOT installed. Do not ask user to run it. Use MCP tool instead. |
| `payments → profiles` FK ambiguity | `payments` has TWO FKs to `profiles`: `profile_id` (member) and `logged_by_admin` (admin). Any PostgREST `.select()` joining `profiles(...)` from `payments` MUST use `profiles!profile_id(...)`. Without it PostgREST returns 500. |
| `Drawer` for admin forms | Use `components/ui/Drawer.tsx` for ALL admin create/edit flows. Exceptions: Announcements create + Quick Links create stay as always-visible inline cards. Delete stays inline with `window.confirm`. |
| Admin form components inside render | NEVER define a form component inside a parent page component. React remounts it on every render causing state reset. Always hoist to module scope. |
| Theme system | Single source: `lib/hooks/useTheme.ts`. Three consumers: `ThemeTile`, `UserDropdown`, `UserPopup`. Same-tab sync via `tevd-theme-change` DOM event. Cross-tab via `StorageEvent`. Key: `tevd-theme`. |
| `--bg-global-rgb` dark override | MUST be `26, 31, 24` in `[data-theme="dark"]`. Header uses `rgba(var(--bg-global-rgb), 0.80)` — without this the navbar renders ~80% white in dark mode. |
| `--text-nav` dark value | `var(--brand-parchment)` in dark mode. Full contrast required on dark navbar backdrop. |
| Nav breakpoint | Desktop nav and hamburger use `lg` (1024px), not `md`. Landscape phones clear `md` — `lg` keeps hamburger on all phones in any orientation. |
| `/guides` cover image | Use `<img>` not `next/image` for Supabase storage URLs. |
| Guide cover bucket | Supabase Storage bucket `guide-covers` (public). RLS: public SELECT, admin INSERT/UPDATE/DELETE. |
| `TeamAttendee` type | Exported from `app/(dashboard)/trips/[id]/page.tsx`. Do not redeclare. |
| RLS pattern | New policies MUST use Pattern A helpers: `is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`. Never `auth.jwt() ->> 'sub'` (resolves to Supabase Auth UUID, not Clerk user — silently non-functional). See ADR-011. |

---

## 6. Supabase MCP Workflow

1. Read existing function/table first with `execute_sql` before writing any DDL.
2. DDL → `apply_migration` only. Never raw `execute_sql` for DDL.
3. Verify result with `execute_sql` after.
4. Save SQL to `supabase/migrations/YYYYMMDDNNNNNN_name.sql`.
5. Run `generate_typescript_types` → write to `types/supabase.ts` → commit in same push as migration.
6. `npx tsc --noEmit` → zero errors → commit.

---

## 7. When This File Is Wrong

If any instruction here contradicts Next.js 16 / Clerk v7 / Supabase current SDK behaviour — stop and flag it. State the contradiction, cite the correct behaviour, ask for a decision before proceeding.
