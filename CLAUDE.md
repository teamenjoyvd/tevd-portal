# CLAUDE.md — teamenjoyVD Portal
> Reference: `docs/ai/REF.md` (read on demand at GATHER, sections only)
> Architecture: `docs/architecture/` (FLOWS.md, DECISIONS.md, C4.md)

---

## Constants

| | |
|---|---|
| Repo | `teamenjoyvd/tevd-portal` |
| Branch | `main` |
| Airtable base | `app1n7KYX8i8xSiB7` |
| Airtable issues table | `tblUq45Wo3xngSf3w` |
| Supabase project | `ynykjpnetfwqzdnsgkkg` |
| Production URL | `https://tevd-portal.vercel.app` |

Never ask the user to confirm these.

---

## Hard Constraints

Violation = immediate stop, no exceptions.

- **NEVER push directly to `main`.** Feature branches only: `feature/SEQ<NNN>-ISS<NNN>`.
- **NEVER create `middleware.ts`.** Auth lives in `proxy.ts`.
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.**
- **NEVER bypass Clerk auth on a protected route.**
- **NEVER write `Status=Done` before the commit link exists.**
- **NEVER mark Done on static analysis alone.** Vercel PR preview must be READY and CI green.
- **NEVER proceed if `Blocked By` is non-empty** without explicit user acknowledgment.
- **NEVER write data to Supabase from a Preview URL** — preview URLs hit production DB.
- **390px mobile-first.** Every new UI surface must render correctly at 390px.
- **RLS policies use Pattern A helpers only** — `is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`. Never raw `auth.jwt()`.
- **shadcn/ui for all interactive primitives** — dialog, popover, dropdown, sheet, tooltip, select, combobox, alert dialog.
- **Component co-location** — new components scoped to one route go in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes.
- **Dual layout law** — two complete separate layouts, no hybrid responsive:
  ```tsx
  <div className="hidden md:block">{/* Desktop */}</div>
  <div className="md:hidden">{/* Mobile */}</div>
  ```
  Canonical reference: `app/(dashboard)/about/page.tsx`

---

## Commands

**SSU** — System Status Update. Run at session start:
1. Airtable `list_bases` — confirm `app1n7KYX8i8xSiB7` reachable.
2. GitHub MCP `get_file_contents` on `CLAUDE.md` — confirms connectivity and loads current state.
3. Airtable queue — query `Status = In Progress` AND `Duplicate = false/empty`. If found: read the active PR's `## Session State` block and report what's in flight before doing anything else. If none: report top `Status = To Do`, `Blocked By = empty`, `Duplicate = false/empty` by Priority.

Output format:
```
| Airtable | ✅/❌ |
| GitHub   | ✅/❌ |
| Queue    | SEQ<NNN>-ISS<NNN>: <n> / All clear |
| Handoff  | IN PROGRESS: <next action> / DONE / No active PR |
```
If any ❌ — stop.

**PIU** — Pack It Up. Run at session end:
1. Confirm PR `## Session State` is `DONE` — write it now if not already done.
2. If REF.md needs updates (schema changed, new routes, new env vars) — update and push in a single `push_files` call together with any other changed docs.
3. If nothing changed in REF.md — done. No other writes required.

---

## Workflow

Issue format: `SEQ<NNN>-ISS<NNN>`. `Seq` is the true PK — Issue ID is not unique.
Commit format: `[SEQ<NNN>-ISS<NNN>] Description`.
Branch format: `feature/SEQ<NNN>-ISS<NNN>`.

**READ** → Query In Progress (resume if found) else top To Do unblocked.

**SHAPE** → Hard stop before claiming — read the relevant doc:
- Auth / role / Clerk sync → `FLOWS.md §1`
- Registration → `FLOWS.md §2`
- Payments → `FLOWS.md §3`
- LOS / tree / notifications → `FLOWS.md §4`
- Vital signs → `FLOWS.md §5` — STOP, pending SO clarification
- New external dependency → update `C4.md` first
- New architectural pattern → write ADR in `DECISIONS.md` before executing

**CLAIM** → Set `Status = In Progress`. Checkout branch.

**GATHER** → Read only the REF.md sections the ticket needs (section map at top of REF.md).

**EXECUTE** → Change only lines required by DoD. Push to trigger Vercel Preview.
- Before any large task (>100 lines): write `IN PROGRESS` to PR `## Session State` first, then commit a skeleton with `// TODO:` items before implementing.

**VERIFY** → DoD point-by-point. Vercel Preview READY. CI green. 390px check. No production side-effects.

**FINALIZE** → Open PR against `main`. After merge: verify Vercel production READY. Write Airtable: `Status=Done` + `CommitLink` + `ClaudeNotes`.

### PR Session State block

The PR description is the sole handoff document.

```markdown
## Session State
**Status:** IN PROGRESS | DONE
**Last touched:** `path/to/file.tsx`
**Completed:**
- [x] done thing
**In flight:** what's partially done, skeleton location if applicable
**Next:** single specific action for incoming instance
```

Write `IN PROGRESS` before starting a large task. Write `DONE` after verifying. If OOT hits mid-task, the skeleton commit is the fallback — it must exist before implementation begins.

---

## Gotchas

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| Clerk auth | `await auth()` → `{ userId }`. No sync auth. No JWT template. |
| Clerk shadow DOM | CSS vars unavailable in Clerk components. Use hardcoded hex (`#bc4749`). |
| Role promotion | Every `profiles.role` update MUST also call `clerk.users.updateUserMetadata`. Routes: `/api/admin/verify`, `/api/admin/members/[id]` PATCH, `/api/admin/members/verify/[id]`. |
| `payments` FK | Two FKs to `profiles`. PostgREST MUST use `profiles!profile_id(...)` — without it, 500. |
| `types/supabase.ts` | Regenerate via `Supabase:generate_typescript_types` MCP only — CLI not installed. |
| Supabase DDL | `apply_migration` only. Never raw `execute_sql` for DDL. Always save to `supabase/migrations/YYYYMMDDNNNNNN_name.sql`. |
| Large GitHub files | `create_or_update_file` times out above ~10KB. Use `push_files`. |
| Mapbox | CDN only — never npm. Dupe guard on load. |
| Mapbox theme swap | `map.setStyle()` + `styledata` event. MutationObserver on `data-theme`. |
| shadcn install | NEVER `npx shadcn@latest init` — corrupts globals.css. Use `npx shadcn@latest add <n>`. After each add, revert any injected `@layer base` blocks. |
| shadcn CSS vars | Edit vended source in `components/ui/` to use project tokens (`--bg-card`, `--text-primary`) not shadcn defaults. |
| shadcn Tabs | NEVER `defaultValue`. Always `value={tab}` + `onValueChange` → `router.replace(?tab=..., { scroll: false })`. Wrap in `<Suspense>`. |
| `--bg-global-rgb` dark | MUST be `26, 31, 24`. Wrong value = white navbar in dark mode. |
| Admin forms | NEVER define a form component inside a parent page component — React remounts on every render. Hoist to module scope. |
| Admin Drawer | Use `components/ui/Drawer.tsx` for all admin create/edit. Exceptions: Announcements + Quick Links create = inline cards. All deletes use `AlertDialog`. |
| Route handler `params` | `params` is a `Promise` in Next.js 16. Type as `{ params: Promise<{ id: string }> }` and `await params`. |
| `useParams()` | Takes NO type argument in Next.js 16. `const params = useParams(); const id = params.id as string`. |
| `sendEmail` | Removed. Use `sendNotificationEmail` (fire-and-forget, respects config gates) or `sendTransactionalEmail` (bypasses gates, returns typed result). **Dynamic imports evade static rename tools and grep** — after any email-related rename, manually read every route that uses `import('@/lib/email/send')`. Known callers (all must use `sendNotificationEmail`): `admin/verify/route.ts`, `admin/members/verify/[id]/route.ts`, `admin/event-role-requests/[id]/route.ts`, `profile/payments/route.ts`. |
| `pg_net` cron | `net.http_post(...)`. NEVER `extensions.http_post(...)` — silently does nothing. |
| `TranslationKey` | Strict union. Add to `translations.ts` before using `t()` or build breaks. |
| `BottomNav.tsx` | Dead stub. Do not import. |
| Profile prerender | Guard ALL `validProfile!` accesses with `if (isLoading \|\| !validProfile) return <ProfileSkeleton />`. |
| `TeamAttendee` type | Exported from `app/(dashboard)/trips/[id]/page.tsx`. Do not redeclare. |

---

## When This File Is Wrong

If any instruction contradicts Next.js 16 / Clerk v7 / Supabase current SDK behaviour — stop, state the contradiction, cite correct behaviour, ask for a decision.
