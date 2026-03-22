# CLAUDE.md — teamenjoyVD Portal
> Last updated: 2026-03-22 — v1.9.2. Latest stable commit: 373c81c.
> Reference material (schema, directory tree, design system, releases) lives in `docs/ai/CONTEXT.md`.
> **CONTEXT.md is never read at SSU. Read specific sections in GATHER only when the ticket targets those areas.**

---

## 0. Commands

| Command | What it does |
|---|---|
| **SSU** | System Status Update — checks all connections, confirms session is ready |
| **PIU** | Pack It Up — session handover, updates CLAUDE.md and CONTEXT.md |

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
2. Update `docs/ai/CONTEXT.md` — schema changes, new routes, new release entry, pending issues.
3. Update Gotchas below if new non-obvious decisions were made this session.
4. Verify latest commit is pushed and Vercel deployment is READY.

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
| Repo | `teamenjoyvd/tevd-portal` — `https://github.com/teamenjoyvd/tevd-portal.git` | Private, `main` only. Never ask user for repo — always use this. |
| Production | `https://tevd-portal.vercel.app` | |

---

## 2. Hard Constraints

Violation = immediate stop.

- **NEVER create `middleware.ts`.** Use `proxy.ts`.
- **NEVER bypass Clerk auth on a protected route.** Security violation.
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** Server-only.
- **NEVER write `Status=Done` before the commit link exists.** Finalization is atomic.
- **NEVER proceed past CLAIM if `Blocked By` is non-empty** without explicit acknowledgment.
- **NEVER mark Done on static analysis alone.** Verify Vercel deployment is READY.

### Desktop / Mobile Layout Law

Two separate complete layouts. No hybrid responsive design. Pattern:
```tsx
<div className="hidden md:block">{/* Desktop */}</div>
<div className="md:hidden">{/* Mobile */}</div>
```
Prohibitions: no BottomNav, no tab bar, no FAB, no `overflow-x-auto` on nav.

**Canonical reference:** `app/(dashboard)/about/page.tsx`

---

## 3. Architecture Rules

- Default to RSC. `"use client"` only for: useState/useReducer, useEffect, browser APIs, event handlers.
- `cookies()` and `headers()` are async in Next.js 16 — always `await`.
- Do not fetch in client components unless real-time or user-triggered.
- No `fetch()` calls with hardcoded `localhost` URLs.
- Revalidation via `revalidatePath` / `revalidateTag` — not full page reload.
- Auth: `const { userId } = await auth()` → 401 if null. All DB queries via `createServiceClient()` (service role).
- Do NOT introduce a Clerk JWT Supabase client without a ticket explicitly scoping it.
- Routing: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`. Dynamic segments: `[param]`. No `getServerSideProps` / `getStaticProps`.
- Schema changes via migration files in `/supabase/migrations/` only. Never raw DDL in app code.
- RLS on every user-facing table. Never disable to fix permissions — fix the policy.
- **Regenerate `types/supabase.ts` after every migration** in the same push. CI enforces this.
- Before migrating a table: grep entire codebase (incl. API routes) for old column names.
- `npx tsc --noEmit` must pass with zero errors before every commit.

---

## 4. Workflow Loop — Airtable → GitHub

Declare phase at opening of every work response: `PHASE: READ | CLAIM | GATHER | EXECUTE | VERIFY | FINALIZE`

**Issue numbering:** `SEQ<NNN>-ISS<NNN>` — e.g. `SEQ116-ISS107`. Always use this format in reports, commit messages, and notes.

**READ:** Query `Status = "In Progress"` AND `Duplicate = false/empty`. Resume if found. Else query `Status = "To Do"` AND `Blocked By = empty` AND `Duplicate = false/empty`, sorted by Priority asc. Probe vague/harmful tickets before claiming.

**CLAIM:** Set `Status = "In Progress"` by **Seq** (not Issue ID). Gate: Blocked By empty + Duplicate false.

**GATHER:** Read relevant sections of `docs/ai/CONTEXT.md` based on ticket scope (see section map in CONTEXT.md header). Read Target Files + DoD from Airtable. Probe vague DoD before writing code.

**EXECUTE:** Write code. Zero-Refactor Rule: change only lines required by DoD.

**VERIFY:** DoD point-by-point. Check Vercel deployment is READY. Iterate if gaps remain.

**FINALIZE:** Commit `[SEQ<NNN>-ISS<NNN>] Short imperative description`. Single Airtable write: `Status=Done` + `CommitLink` + `ClaudeNotes`.

### Airtable Reference

**Base:** `app1n7KYX8i8xSiB7` — **Issues Table:** `tblUq45Wo3xngSf3w`

| Field | ID |
|---|---|
| Issue ID | `fldE1F4ViLRQml5Hw` |
| Seq (unique PK) | `fldnKdNxb4YjdHoIf` |
| Name | `fldOSw4VEE9mXDpTm` |
| Type | `fldQN5hAQoMFdXxyl` |
| Status | `fldsTwNbtnh6SUuF0` |
| Priority | `flde5GkbsiEi4jtwq` |
| Blocked By | `fldRq9a57bHubveIx` |
| Target Files | `fld2hLIPYvrhcyiMA` |
| Definition of Done | `fld5U92AZuxpLHsuJ` |
| Claude Notes | `fldYsznuq4tUt79o4` |
| Commit Link | `fld0VWrOimUTolMIe` |
| Duplicate | `fld2P6m5fMOsi1q3G` |

| Status | Choice ID |
|---|---|
| To Do | `selO8Bg7VWY6E9sxB` |
| In Progress | `sel4MPU6wsEW7uclv` |
| Done | `selRTL4WT8qro1TnL` |
| Not relevant | `sellrX5il5BmfBxm9` |
| Needs Design | `sel98265UTlgLcw5r` |
| Blocked | `sellZeVnRByP94606` |
| Archived | `selfMrAD2qCxrMoXg` |

Duplicate-safe: every READ must filter `Duplicate = false/empty`. Fetch all and discard `fld2P6m5fMOsi1q3G === true` if MCP can't filter checkboxes.

---

## 5. Code Style

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

## 6. Gotchas (non-derivable decisions)

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| `cookies()` | Must be `await`ed in Next.js 16. |
| Tailwind v4 | No `@layer` + `@apply`. Inline utilities only. |
| Mapbox | CDN only. Dupe guard on load. Logo/attribution hidden via globals.css. |
| Mapbox theme swap | `map.setStyle()` + `styledata` event. MutationObserver on `data-theme`. |
| Mapbox About tile style | `outdoors-v12` (light) / `dark-v11` (dark). |
| Clerk shadow DOM | CSS vars unavailable. Use hardcoded hex (`#bc4749`). |
| Clerk v7 auth | `await auth()` → `{ userId }`. No sync auth. No JWT template. |
| Role promotion | Every `profiles.role` update MUST also call `clerk.users.updateUserMetadata`. Routes: `/api/admin/verify`, `/api/admin/members/[id]` PATCH, `/api/admin/members/verify/[id]`. Pre-fix cohort (before commit 4b2d69c) has stale metadata — re-login to fix. |
| `useLanguage` | Dispatches `window.dispatchEvent(new Event('language-changed'))` on toggle. |
| `useParams()` | No type argument in Next.js 16. Cast result: `const id = params.id as string`. |
| `DEFAULT_ORDER` | Declare as `string[]` not inferred const tuple — `Array.prototype.includes` rejects `string` args on readonly tuples. |
| Profile page prerender | `/profile` prerenders. Guard ALL `validProfile!` accesses with `if (isLoading || !validProfile) return <ProfileSkeleton />` before any JSX referencing profile fields. |
| `dnd-kit` forwardRef | `DragHandle` must use `React.forwardRef` — React 19 rejects `ref` on plain function components. |
| Seq is the true PK | `Issue ID` is NOT unique. `Seq` (autonumber) is the PK. Always target by Seq. Issue format: `SEQ<NNN>-ISS<NNN>`. Commit format: `[SEQ<NNN>-ISS<NNN>] Description`. |

---

## 7. Supabase MCP Workflow

1. **Read existing function/table first** with `execute_sql` before writing any DDL.
2. DDL → `apply_migration` only. Never raw `execute_sql` for DDL.
3. Verify result with `execute_sql` after.
4. Save SQL to `supabase/migrations/YYYYMMDDNNNNNN_name.sql`.
5. Run `generate_typescript_types` → write to `types/supabase.ts` → commit in same push as migration.
6. `npx tsc --noEmit` → zero errors → commit.

### RLS Pattern
```sql
(auth.jwt() ->> 'user_role') IN ('admin', 'core')
profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
```

### CI Type Check
On every push to `main`: (1) Supabase type drift check — diffs live DB against `types/supabase.ts`, fails with fix command if stale. (2) `tsc --noEmit`. Required secret: `SUPABASE_ACCESS_TOKEN` in repo secrets. See CONTEXT.md §12 for full CI detail.

---

## 8. When This File Is Wrong

If any instruction here contradicts Next.js 16 / Clerk v7 / Supabase current SDK behaviour — stop and flag it. Do not silently comply. State the contradiction, cite the correct current behaviour, and ask for a decision before proceeding.

---

## 9. Reference

For schema, directory structure, key files & patterns, navigation, design system, i18n, admin pages, access control flows, LOS, calendar, CI detail, and release history — read `docs/ai/CONTEXT.md`.

### CONTEXT.md section map — read only what the ticket needs

| Section | Read when ticket touches |
|---|---|
| §1 Directory tree | New files, new routes, component moves |
| §2 Key files & patterns | `lib/`, `components/`, established patterns |
| §3 Navigation | Header, Footer, AdminNav, `lib/nav.ts` |
| §4 Schema | DB, API routes, `types/supabase.ts`, migrations |
| §5 Design system | Bento, tokens, colors, layout, role colors |
| §6 i18n & regional | `translations.ts`, `t()`, `lib/format.ts` |
| §7 Access control | Auth, RLS, verification paths, Clerk sync |
| §8 LOS & notifications | `tree_nodes`, triggers, `pg_cron` |
| §9 Calendar | `CalendarClient`, `--cal-height`, period views |
| §10 Admin pages | Any `/admin/*` page |
| §11 Env vars | New secrets, deployment config |
| §12 CI | `types/supabase.ts`, `check-types.yml` |

For live schema — `Supabase:list_tables` verbose is always more current than CONTEXT.md.
