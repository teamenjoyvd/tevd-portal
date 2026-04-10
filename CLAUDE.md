# CLAUDE.md — teamenjoyVD Portal
> Last updated: 2026-04-10 — v2.1.0. Latest stable commit: 044499e.
> Architecture docs: `docs/architecture/`. Reference tables: `docs/ai/LOOKUP.md`. Context: `docs/ai/CONTEXT.md`.
> **Neither CONTEXT.md nor LOOKUP.md is read at session start or proactively. Read only sections relevant to the current ticket during GATHER (section map in CONTEXT.md header).**

---

## 0. Commands

| Command | What it does |
|---|---|
| **SSU** | System Status Update — checks all connections, confirms session is ready |
| **PIU** | Pack It Up — session handover, updates docs |

---

## SSU — System Status Update

Execute in full, in order:

1. **Airtable** — `list_bases`. Confirm `app1n7KYX8i8xSiB7` reachable. ✅/❌
2. **GitHub MCP** — `get_file_contents` on `CLAUDE.md` from `teamenjoyvd/tevd-portal`. ✅/❌
3. **Vercel** — `list_deployments`. Confirm latest production deployment is READY. ✅/❌
4. **Supabase** — `list_projects`. Confirm `ynykjpnetfwqzdnsgkkg` is `ACTIVE_HEALTHY`. ✅/❌
5. **Queue** — check Issues for `Status = "In Progress"` AND `Duplicate = false/empty`. If found, report it. Else report highest-priority unblocked `Status = "To Do"` AND `Duplicate = false/empty` ticket.

```
| Connection | Status | Notes |
|------------|--------|-------|
| Airtable   | ✅/❌  | ...   |
| GitHub MCP | ✅/❌  | ...   |
| Vercel     | ✅/❌  | ...   |
| Supabase   | ✅/❌  | ...   |
| Queue      | —      | SEQ<NNN>-ISS<NNN>: ... / All clear |
```

If any ❌ — stop.

---

## PIU — Pack It Up

1. Update CLAUDE.md header (stable commit, date). **Use `push_files` — file exceeds ~10KB and `create_or_update_file` will time out.**
2. Update `docs/ai/CONTEXT.md` — new routes, new release entry, pending issues.
3. Update `docs/ai/LOOKUP.md` — schema changes, new env vars, new API routes.
4. Update `docs/architecture/` — if session introduced a new flow, external system, or architectural decision.
5. Update Gotchas (§5) if new non-obvious decisions were made this session.
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
| UI Primitives | shadcn/ui | Add components: `npx shadcn@latest add <n>`. Source vended into `components/ui/`. |
| Middleware | `proxy.ts` | **NEVER create `middleware.ts`.** |
| Deployment | Vercel | Team: `teamenjoyvd`. Project: `prj_HFZJZg2vkLtpX8XvjJlo3mDkSCyn`. |
| Repo | `teamenjoyvd/tevd-portal` | Private. **Never push directly to `main`.** Feature branches: `feature/SEQ<NNN>-ISS<NNN>`. |
| Production | `https://tevd-portal.vercel.app` | |

---

## 2. Hard Constraints

Violation = immediate stop.

- **NEVER push directly to `main`.** All commits go to `feature/SEQ<NNN>-ISS<NNN>` branches, merged via PR.
- **NEVER write data to Supabase from a Preview URL** unless structurally isolated. Preview URLs hit the production database.
- **NEVER create `middleware.ts`.** Use `proxy.ts`.
- **NEVER bypass Clerk auth on a protected route.**
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.**
- **NEVER write `Status=Done` before the commit link exists.**
- **NEVER proceed past CLAIM if `Blocked By` is non-empty** without explicit acknowledgment.
- **NEVER mark Done on static analysis alone.** Verify Vercel PR preview is READY AND CI passes.
- **390px Mobile-First:** Every new UI surface must render correctly at 390px.
- **RLS policies MUST use Pattern A helpers** (`is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`). Never raw `auth.jwt()`. See ADR-011.
- **Component co-location:** New components scoped to a single route live in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes. Exempt: `components/layout`, `components/bento`, `components/ui`. See ADR-012.
- **shadcn/ui for interactive primitives:** dialog, popover, dropdown, sheet, tooltip, select, combobox, alert dialog — all must use shadcn/ui. See ADR-013.

### Desktop / Mobile Layout Law

Two separate complete layouts. No hybrid responsive design:
```tsx
<div className="hidden md:block">{/* Desktop */}</div>
<div className="md:hidden">{/* Mobile */}</div>
```
No BottomNav, tab bar, FAB, or `overflow-x-auto` on nav. **Canonical ref:** `app/(dashboard)/about/page.tsx`

---

## 3. Workflow Loop

Declare phase at opening of every work response: `PHASE: READ | SHAPE | CLAIM | GATHER | EXECUTE | VERIFY | FINALIZE`

**Issue format:** `SEQ<NNN>-ISS<NNN>`. Commit format: `[SEQ<NNN>-ISS<NNN>] Description`. `Seq` (autonumber) is the true PK — `Issue ID` is not unique.

**READ:** Query `Status = "In Progress"` AND `Duplicate = false/empty`. Resume if found. Else query `Status = "To Do"` AND `Blocked By = empty` AND `Duplicate = false/empty`, sorted by Priority asc.

**SHAPE:** Hard stop — read the relevant doc before claiming:
- Auth / role / Clerk sync → `FLOWS.md §1`
- Registration status → `FLOWS.md §2`
- Payments → `FLOWS.md §3`
- LOS / tree / notifications → `FLOWS.md §4`
- Vital signs → `FLOWS.md §5` (pending SO clarification — stop)
- New external dependency → update `C4.md` first
- New architectural pattern/library → write ADR in `DECISIONS.md` before EXECUTE

**CLAIM:** Set `Status = "In Progress"` by Seq. Gate: Blocked By empty + Duplicate false. Checkout `feature/SEQ<NNN>-ISS<NNN>`.

**GATHER:** Read only the sections of `docs/ai/CONTEXT.md` and `docs/ai/LOOKUP.md` relevant to this ticket (section map in CONTEXT.md header).

**EXECUTE:** Change only lines required by DoD (Zero-Refactor Rule). Push commits to trigger Vercel Preview.

**VERIFY:** DoD point-by-point. Check Vercel Preview URL. 390px mobile validation. Read-only — no production side-effects. Confirm CI (`check-types.yml`) green.

**FINALIZE:** Open PR against `main`. After merge, verify Vercel production READY. Single Airtable write: `Status=Done` + `CommitLink` + `ClaudeNotes`.

### Airtable Reference
**Base:** `app1n7KYX8i8xSiB7` — **Issues:** `tblUq45Wo3xngSf3w`
→ Field IDs and Status choice IDs: `docs/ai/LOOKUP.md §7`
Filter `Duplicate = false/empty`; discard `fld2P6m5fMOsi1q3G === true` if MCP can't filter checkboxes.

---

## 4. Code Style

- Zero-Refactor Rule: change only lines required by DoD.
- No `any` — use `unknown` and narrow.
- No `console.log` in committed code.
- No default exports from utility files.
- No barrel `index.ts` unless one already exists.
- Explicit return types on route handlers and server actions.
- `<img>` for user-uploaded images (domains unpredictable).
- `TranslationKey` is strict — add to `lib/i18n/translations.ts` before using `t()` or build breaks.
- `useParams()` takes NO type argument in Next.js 16. `const params = useParams(); const id = params.id as string`.

---

## 5. Gotchas

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| Mapbox | CDN only. Dupe guard on load. Logo/attribution hidden via globals.css. |
| Mapbox theme swap | `map.setStyle()` + `styledata` event. MutationObserver on `data-theme`. |
| Mapbox About tile | `outdoors-v12` (light) / `dark-v11` (dark). |
| Clerk shadow DOM | CSS vars unavailable. Use hardcoded hex (`#bc4749`). |
| Clerk v7 auth | `await auth()` → `{ userId }`. No sync auth. No JWT template. |
| Role promotion | Every `profiles.role` update MUST also call `clerk.users.updateUserMetadata`. Routes: `/api/admin/verify`, `/api/admin/members/[id]` PATCH, `/api/admin/members/verify/[id]`. Pre-fix cohort (before 4b2d69c) has stale metadata — re-login to fix. |
| `useLanguage` | Dispatches `window.dispatchEvent(new Event('language-changed'))` on toggle. |
| Profile prerender | `/profile` prerenders. Guard ALL `validProfile!` accesses with `if (isLoading \|\| !validProfile) return <ProfileSkeleton />`. |
| `types/supabase.ts` | Regenerate via `Supabase:generate_typescript_types` MCP only — CLI not installed. |
| `payments → profiles` FK | Two FKs to `profiles`. PostgREST `.select()` MUST use `profiles!profile_id(...)` — without it, 500. |
| Admin Drawer | Use `components/ui/Drawer.tsx` for all admin create/edit. Exceptions: Announcements + Quick Links create stay as inline cards. All deletes use `AlertDialog` — `window.confirm` retired. |
| Admin form components | NEVER define a form component inside a parent page component — React remounts on every render. Hoist to module scope. |
| Theme system | Single source: `lib/hooks/useTheme.ts`. Same-tab: `tevd-theme-change` DOM event. Cross-tab: `StorageEvent`. Key: `tevd-theme`. |
| `--bg-global-rgb` dark | MUST be `26, 31, 24`. Header uses `rgba(var(--bg-global-rgb), 0.80)` — wrong value = white navbar in dark mode. |
| `--text-nav` dark | `var(--brand-parchment)`. Full contrast on dark navbar backdrop. |
| Nav breakpoint | `lg` (1024px), not `md`. Landscape phones clear `md` — `lg` keeps hamburger on all phones. |
| Guide cover image | `<img>` not `next/image` for Supabase storage URLs. Bucket: `guide-covers` (public). RLS: public SELECT, admin INSERT/UPDATE/DELETE. |
| `TeamAttendee` type | Exported from `app/(dashboard)/trips/[id]/page.tsx`. Do not redeclare. |
| shadcn install | NEVER `npx shadcn@latest init` — corrupts globals.css. Add: `npx shadcn@latest add <n>`. After each add, revert any injected `@layer base` blocks. |
| shadcn CSS vars | shadcn refs `--background`, `--foreground`, etc. Edit vended source in `components/ui/` to use project tokens (`--bg-card`, `--text-primary`). |
| shadcn Tabs | NEVER `defaultValue`. Always `value={tab}` + `onValueChange={(val) => router.replace(\`?tab=${val}\`, { scroll: false })}`. `scroll: false` is mandatory. Wrap in `<Suspense>`. |
| Route handler `params` | `params` is a `Promise` in Next.js 16. Type as `{ params: Promise<{ id: string }> }` and `await params`. |
| GitHub MCP large files | `create_or_update_file` times out above ~10KB. Use `push_files`. |
| pg_net cron calls | Use `net.http_post(...)`. NEVER `extensions.http_post(...)` — silently does nothing. |

---

## 6. Supabase MCP Workflow

1. `execute_sql` to read existing state before any DDL.
2. DDL → `apply_migration` only. Never raw `execute_sql` for DDL.
3. `execute_sql` to verify after.
4. Save SQL to `supabase/migrations/YYYYMMDDNNNNNN_name.sql`.
5. `generate_typescript_types` → write to `types/supabase.ts` → commit in same push as migration.
6. `npx tsc --noEmit` → zero errors → commit.

---

## 7. When This File Is Wrong

If any instruction contradicts Next.js 16 / Clerk v7 / Supabase current SDK behaviour — stop. State the contradiction, cite the correct behaviour, ask for a decision.
