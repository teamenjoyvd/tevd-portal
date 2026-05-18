# GOTCHAS — tevd-portal

Read in full during SHAPE and GATHER. Add new entries here immediately when a sharp edge is discovered — never inline in code comments alone.

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| Clerk auth | `await auth()` → `{ userId }`. No sync auth. No JWT template. |
| Clerk shadow DOM | CSS vars unavailable in Clerk components. Use hardcoded hex (`#bc4749`). |
| Role promotion | Every `profiles.role` update MUST also call `clerk.users.updateUserMetadata`. Routes: `/api/admin/verify`, `/api/admin/members/[id]` PATCH, `/api/admin/members/verify/[id]`. |
| `payments` FK | Two FKs to `profiles`. PostgREST MUST use `profiles!profile_id(...)` — without it, 500. |
| `types/supabase.ts` | Regenerate via `Supabase:generate_typescript_types` MCP only — CLI not installed. Regeneration is mandatory after any migration that touches an enum; `lib/roles.ts` derives `MemberRole` and `ALL_ROLES` from this file and will emit a compile error on missing/extra keys. |
| Supabase DDL | `apply_migration` only. Never raw `execute_sql` for DDL. Migration filename: `YYYYMMDD_NNN_description.sql` where `NNN` is a zero-padded 3-digit counter. Before writing a filename, list `supabase/migrations/` and find the highest `NNN` for today's date — increment by 1, reset to `001` on a new day. Never use `HHMMSS` — wall-clock seconds collide within a session. |
| Migration CI | `migrate-dev.yml` and `migrate-prod.yml` have been removed (PR #309). Migrations applied exclusively via `Supabase:apply_migration` MCP. Never attempt to restore these workflows — the MCP-applied `schema_migrations` timestamps are incompatible with CLI filename-based reconciliation. |
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
| `sendEmail` | Removed. Use `sendNotificationEmail` (fire-and-forget, respects config gates) or `sendTransactionalEmail` (bypasses gates, returns typed result). **Dynamic imports evade static rename tools and grep** — after any email-related rename, manually read every route using `import('@/lib/email/send')`. Known callers in `sendNotificationEmail` JSDoc. |
| `pg_net` cron | `net.http_post(...)`. NEVER `extensions.http_post(...)` — silently does nothing. |
| `TranslationKey` | Strict union. Add to `translations.ts` before using `t()` or build breaks. |
| `BottomNav.tsx` | Dead stub. Do not import. |
| Profile prerender | Guard ALL `validProfile!` accesses with `if (isLoading \|\| !validProfile) return <ProfileSkeleton />`. |
| `TeamAttendee` type | Exported from `app/(dashboard)/trips/[id]/page.tsx`. Do not redeclare. |
| Trusted RPC + service role | Any RPC that performs cross-user writes MUST be `SECURITY DEFINER SET search_path = public`. Because SECURITY DEFINER bypasses RLS, the function body MUST include an internal authorization check: `IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;`. Pattern A helpers return false/null under service-role with no JWT. `SECURITY INVOKER` is only safe for read-only helpers or trigger functions. |
