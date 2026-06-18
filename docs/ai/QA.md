# Q&A & Backlog Reference Document

This document compiles technical questions, answers, and the current backlog of planned developments for the `tevd-portal` codebase.

---

## Current Todo Backlog

### 1. Roles Page Refactor (`app/(dashboard)/roles/page.tsx`)
* **Current Quarter Querying:** Modify the database fetch to retrieve meetings starting from the beginning of the current quarter (e.g., April 1 to June 30 for Q2 2026) instead of only querying future events (`gte('start_time', now)`).
* **Past Meetings Styling:** Mute or gray out past meetings within the current quarter visually to make them distinct from upcoming ones.
* **History & Analytics View:** Add a "History" button that triggers a detailed view with:
  * Full historical data of all past meetings across all quarters and years.
  * Search/filter options (by Year, Quarter, Roles, and Members).
  * Counter metrics summarizing participation counts (e.g., total times hosted/spoken/handled products per member).

### 2. User Dropdown Profile Link (`components/layout/UserDropdown.tsx`)
* **Regular User Profile Action:** When a non-admin user opens the dropdown, render a styled menu item (matching the style and position of the "Admin" button) that links to `/profile` (translating dynamically as "Profile" / "Профил").

---

## Reference Q&A

### 1. Authentication Refactor Prompting

**Question:** If I had to ask you to refactor the authentication, how should that prompt look like?

**Answer:** Use the issue structure defined in `CLAUDE.md`:
```markdown
REFACTOR: [Short description of the authentication refactor]

## Context
[Explain the goal of the refactor. For example: "We need to split API routes into public/private tiers, update public-routes helper list, or introduce role-based API protection via custom headers set in proxy.ts."]

## Design
- **Proxy/Routing:** All custom authentication routing, request rewriting, or route matching must reside inside `proxy.ts` (Option C Hybrid middleware structure). Do not place custom routing logic directly in `middleware.ts`.
- **Async Verification:** All check/verification sites must use the asynchronous `auth()` call:
  ```typescript
  const { userId } = await auth();
  ```
- **Clerk / Supabase separation:** Ensure we do not leak the Supabase service role key to any client-side routes, and that Clerk acts as the single source of truth for the active `userId`.

## Definition of Done
- [ ] `proxy.ts` updated to route/allow [specific routes/conditions]
- [ ] `lib/public-routes.ts` updated with [new route matchers]
- [ ] Protected route handlers verify `userId` asynchronously at the beginning of the function
- [ ] CI builds successfully and Vercel preview is READY

## Affected Files
- `proxy.ts` (modify)
- `lib/public-routes.ts` (modify)
- `app/api/...` (modify)

## Gotchas & Constraints
- **NEVER** create or modify a root `middleware.ts` to contain custom routing logic (auth logic belongs in `proxy.ts`).
- **NEVER** bypass Clerk auth on a protected route.
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

## Branch
dev/[YYMM]-DEV-[GH#]
```

### 2. Complete Current Authentication Structure

**Question:** Are you able to list the complete current authentication?

**Answer:** 
* **The Entry Point Proxy Middleware ([proxy.ts](file:///c:/Users/fefence/Downloads/react/teamenjoyvd/tevd-portal/proxy.ts)):** Consolidates Clerk's middleware and routing logic. Unauthenticated API calls return `401`, and unauthenticated page hits redirect to `/sign-in`.
* **Public vs. Private Routes ([lib/public-routes.ts](file:///c:/Users/fefence/Downloads/react/teamenjoyvd/tevd-portal/lib/public-routes.ts)):** Controls the list of routes that bypass auth.
* **Route/Action-Level Verification:** Every protected component, handler, or Action calls `await auth()` asynchronously.
* **Database RLS Mapping:** Maps Clerk IDs to profiles and evaluates rules via custom RLS helper functions like `is_admin()`.

### 3. Page Reload Stale State during Login/Logout

**Question:** Why are some pages not reloaded properly before/after login/logout?

**Answer:** Next.js uses client-side route caching and pre-renders static routes by default. When authentication changes, the browser cache is not automatically invalidated. To fix it, pages must force dynamic rendering (`export const dynamic = 'force-dynamic'`), and sign-in/out transitions should trigger `router.refresh()` or a full page reload (`window.location.href`).

### 4. Lack of Loading Animation during Page Transitions

**Question:** Why do we not have a loading animation? Some page transitions take a while and loading animation will be in fact useful.

**Answer:** Next.js App Router transitions are blocking by default unless a `loading.tsx` boundary is defined. Because no `loading.tsx` exists at the root or main layout folders, navigations wait silently in the background for Server Components to resolve. Adding a global top loader like `nextjs-toploader` or folder-level `loading.tsx` templates will fix this.
