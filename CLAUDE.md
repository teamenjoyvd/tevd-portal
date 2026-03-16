# CONTEXT.md — N21 Community & LOS Management Portal (teamenjoyVD)
> Last updated: March 2026 — post v1.2.0 stable release

---

## 1. Project Overview & Operational Rules
Internal management portal for **teamenjoyVD (N21 Community)**.

**Role:** Senior technical collaborator. Direct, peer-to-peer communication.

### Core Rules
- **Zero-Refactor Rule:** No logic cleanup, DRYing, or unsolicited refactoring. Preserve original line counts and formatting.
- **Airtable-First Workflow:** Claude MUST query Airtable before starting any session to identify the active task.
- **React 19 Patterns:** Prioritize the `use()` hook for handling Promises in Client Components over `useEffect` where applicable.
- **Git Strategy:** Conclude sessions with `git add . && git commit -m "..." && git push origin main`.

---

## 2. External Integration Schema

### Airtable (Project Management)
- **Base ID:** `tevd-portal` (N21 Management Portal)
- **Tables:** - `Tasks`: Primary dev tracking. Fields: `Status`, `Claude Notes`, `Commit Link`.
  - `Feature Requests`: Pipeline for new modules.
  - `Bug Reports`: Critical fixes.

### Infrastructure IDs
- Supabase project: `ynykjpnetfwqzdnsgkkg` (eu-west-1)
- Vercel project: `prj_HFZJZg2vkLtpX8XvjJlo3mDkSCyn`

---

## 3. Tech Stack & Infrastructure
- **Framework:** Next.js 16.1.6 (App Router) + React 19.
- **Auth:** Clerk (Custom JWT template `supabase` using `user_id` and `user_role`).
- **Database:** Supabase (PostgreSQL 17) with LTree and RLS.
- **Middleware:** `proxy.ts` (Next.js 16 convention).
- **Styling:** Tailwind CSS v4 (Inline classes only; no `@apply`).

---

## 4. Key Module Logic
- **LOS:** Adjacency List + LTree. RPC `import_los_members` for CSV.
- **Calendar:** `sync-google-calendar` Edge Function via `pg_cron`.
- **Layout:** 1024px centered via `PageContainer` and `PageHeading`.