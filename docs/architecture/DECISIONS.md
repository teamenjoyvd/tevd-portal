# DECISIONS.md — Architecture Decision Records
> tevd-portal · Last updated: 2026-03-28
> Format: Context | Decision | Consequences (Benefits / Risks / Mitigations)
> Records are never deleted. Superseded records are marked and linked to their replacement.

---

## Index

| ID | Decision | Date | Status |
|----|----------|------|--------|
| ADR-001 | ltree for LOS hierarchy over recursive CTEs | 2026-03 | Active |
| ADR-002 | Service role for all server DB access (no JWT client) | 2026-03 | Active |
| ADR-003 | Mapbox as CDN-only integration (no npm) | 2026-03 | Active |
| ADR-004 | Dual-approval payment model (no payment processor) | 2026-03 | Active |
| ADR-005 | Clerk as identity provider with manual Supabase metadata sync | 2026-03 | Active |
| ADR-006 | proxy.ts as the sole middleware file (never middleware.ts) | 2026-03 | Active |
| ADR-007 | Unified payments table (single table, entity check constraint) | 2026-03 | Active |
| ADR-008 | Strict TranslationKey union over i18n library | 2026-03 | Active |
| ADR-009 | Dual-layout pattern (two complete layouts, not responsive) | 2026-03 | Active |
| ADR-010 | 12-column CSS grid for BentoGrid (not a component library) | 2026-03 | Active |
| ADR-011 | RLS as defence-in-depth layer; canonical policy pattern uses Clerk JWT helper functions | 2026-03 | Active |
| ADR-012 | Feature-based folder structure: co-locate route-scoped components | 2026-03 | Active |
| ADR-013 | shadcn/ui as the mandatory primitive library for interactive components | 2026-03 | Active |
| ADR-014 | Cookie-based transport for UI preference synchronisation | 2026-03-28 | Active |

---

## ADR-001 — ltree for LOS Hierarchy

**Date:** 2026-03
**Status:** Active

### Context
The organisation has a multi-level downline (LOS — Line of Sponsorship) where each member has exactly one upline. The system needs to support: displaying a member's full downline, scoping notifications to ancestors/descendants, and importing/reconciling LOS data from an external source. The depth can be 10+ levels. Both reads and writes to the tree are frequent.

### Decision
Use PostgreSQL's `ltree` extension, storing each node's full ancestor path as a materialized label chain in `tree_nodes.path` (e.g., `100001.100045.p_abc123`). GiST index on the path column.

### Why not recursive CTEs
Recursive CTEs compute the tree at query time. For a subtree query at depth 5 with 500 descendants, this means 500+ recursive steps per query. ltree with a GiST index reduces the same query to a single index scan using the `<@` (is descendant of) operator. The read performance difference is an order of magnitude at the scale expected.

### Consequences

**Benefits:**
- Subtree queries are O(log n) with the GiST index regardless of depth
- Ancestor queries (`@>`) are equally fast
- Path is human-readable and directly maps to ABO number chains
- pg_cron digest and notification fan-out both use ltree operators efficiently

**Risks:**
- Renaming a node (ABO assignment to a previously no-ABO node) requires `rebuild_tree_paths` to cascade the rename to all descendants — this is a write-heavy operation proportional to subtree size
- ltree labels have character restrictions — ABO numbers and `p_<uuid>` labels must be sanitised before insertion
- LOS import always wins for positioning, which can conflict with manually-placed nodes if reconciliation is not run

**Mitigations:**
- `rebuild_tree_paths` is called server-side, not triggered by the user directly
- ABO label sanitisation is handled in the import pipeline
- Reconciliation panel in `/admin/data-center` exists for exactly this conflict case

---

## ADR-002 — Service Role for All Server DB Access

**Date:** 2026-03
**Status:** Active

### Context
Supabase supports two access patterns from Next.js: (1) service role key — bypasses RLS entirely, full access; (2) JWT client — passes the user's Clerk JWT, RLS policies evaluate it. Both are viable.

### Decision
All server-side database access uses `createServiceClient()` (service role). The anon key and JWT client are never used on the server. Access control is enforced in route handlers by checking `userId` from `await auth()` and the user's `role` from their profile, not by RLS policy evaluation on the server.

### Why not the JWT client
The Clerk JWT contains a `user_role` claim that Supabase RLS policies can read. However, making this work requires configuring a Clerk JWT template in Supabase, keeping the JWT secret in sync, and writing RLS policies that accurately mirror every business rule. Any mismatch between policy and application intent is a silent security gap — there is no type-safety or test coverage for RLS policy logic. The service role approach makes access logic explicit and testable in TypeScript.

### Consequences

**Benefits:**
- Access control logic lives in TypeScript route handlers — readable, type-safe, testable
- No JWT template configuration required in either Clerk or Supabase
- No risk of RLS policy drift silently opening or closing access
- Simpler local development — no JWT plumbing required

**Risks:**
- Service role bypasses RLS entirely — a bug in a route handler can expose or mutate any data
- RLS policies still exist on tables but are not the primary enforcement mechanism for server routes

**Mitigations:**
- Every protected route explicitly calls `await auth()` and returns 401 if `userId` is null — enforced by convention and code review
- RLS policies exist as a defence-in-depth layer, protecting against hypothetical direct DB access or future anon client usage
- This decision is explicitly documented in CLAUDE.md as a hard constraint: "Do NOT introduce a Clerk JWT Supabase client without a ticket explicitly scoping it"

---

## ADR-003 — Mapbox as CDN-Only Integration

**Date:** 2026-03
**Status:** Active

### Context
The application needs interactive maps on `/about` and `/profile`. Mapbox GL JS is the chosen library. It can be installed via npm or loaded via CDN script tag.

### Decision
Mapbox GL JS is loaded exclusively via CDN script tag. It is never installed as an npm package.

### Why not npm
Mapbox GL JS is a large bundle (~900KB minified). Adding it to the npm dependency graph means it is included in the Next.js bundle analysis, subject to tree-shaking failures, and increases cold-start time for server components that don't need it. The CDN approach loads it only on pages that render a map tile, in parallel with the page, and is cached aggressively by the browser.

### Consequences

**Benefits:**
- Zero impact on Next.js bundle size
- CDN caching means repeat visitors pay no load cost
- No npm version lock — CDN version can be pinned independently
- Simpler import model: `window.mapboxgl` is available after script load, no module resolution required

**Risks:**
- External CDN dependency — if Mapbox CDN is unavailable, map tiles fail
- Version must be managed manually (currently v2.15.0)
- A dupe-guard is required to prevent double-initialisation on React hot reload

**Mitigations:**
- Map tiles are non-critical UI — their failure degrades gracefully (tile container renders empty)
- Dupe-guard pattern is implemented in `AboutMapTile.tsx` and documented in CLAUDE.md gotchas
- Version is pinned in the script URL, not floating

---

## ADR-004 — Dual-Approval Payment Model (No Payment Processor)

**Date:** 2026-03
**Status:** Active

### Context
Members pay for trips and merchandise via cash or bank transfer — no credit card processing. The system needs to track payment claims from both sides: members claiming they paid, and admins confirming receipt.

### Decision
All payments are manual records in the unified `payments` table with two independent status columns: `admin_status` and `member_status`. A payment is "green" (fully confirmed) only when both are `approved`. No payment processor is integrated.

### Submission paths
- **Member-submitted:** Member creates record with proof (`logged_by_admin = NULL`, `member_status = 'approved'`, `admin_status = 'pending'`). Admin must approve.
- **Admin-logged:** Admin creates record on behalf of a member (`logged_by_admin = admin_profile_id`, `admin_status = 'approved'`, `member_status = 'pending'`). Member must confirm.

### Consequences

**Benefits:**
- Accurately models the real-world process — both parties must agree on a payment
- No third-party payment processor dependency, PCI scope, or webhook complexity
- Admin can log historical payments and members can dispute

**Risks:**
- No automated reconciliation — admin must manually verify bank transfers
- Dual-approval adds UI complexity (members see pending admin-logged items, admins see pending member submissions)
- If a payment processor is added in future, this model will need a third status path or a new table

**Mitigations:**
- Admin operations page (`/admin/operations?tab=payments`) surfaces pending member submissions at the top for easy review
- The entity check constraint (`num_nonnulls(trip_id, payable_item_id) = 1`) is DB-enforced, preventing orphaned payment records
- FK ambiguity on `payments → profiles` (two FKs) is documented as a hard gotcha in CLAUDE.md

---

## ADR-005 — Clerk as Identity Provider with Manual Metadata Sync

**Date:** 2026-03
**Status:** Active

### Context
The application needs authentication, session management, and a way to communicate role information to Supabase RLS policies via JWT. Options considered: Supabase Auth, Clerk, Auth.js.

### Decision
Clerk is the identity provider. User roles are stored in Clerk `publicMetadata.role` in addition to `profiles.role` in Supabase. The two must be kept in sync manually on every role change. The Clerk JWT carries the role, making it available to Supabase RLS policies without a separate lookup.

### Why Clerk over Supabase Auth
Supabase Auth is tightly coupled to the Supabase JWT secret. Clerk provides a more complete hosted auth solution (social login, MFA, user management UI, webhook emission) without requiring Supabase's auth infrastructure. The tradeoff is the manual sync requirement.

### Consequences

**Benefits:**
- Clerk provides a full-featured hosted auth UI (sign-in, sign-up, MFA)
- `publicMetadata.role` in the JWT means RLS policies can read role without a profile lookup
- Clerk webhook (`user.created`) drives profile creation — no dual-write on sign-up

**Risks:**
- Role sync is manual and can drift — if `clerk.users.updateUserMetadata` fails after the Supabase write, the JWT carries a stale role until the user re-logs in
- Pre-fix cohort (users promoted before commit 4b2d69c) has stale Clerk metadata permanently until re-login

**Mitigations:**
- Every role promotion route explicitly calls both writes — enforced by CLAUDE.md hard constraint and documented in gotchas
- The three affected routes are named explicitly: `/api/admin/verify`, `/api/admin/members/verify/[id]`, `/api/admin/members/[id]` PATCH
- Re-login forces a fresh JWT, resolving stale metadata for any affected user

---

## ADR-006 — proxy.ts as the Sole Middleware File

**Date:** 2026-03
**Status:** Active

### Context
Next.js middleware runs on every request and is the correct place to enforce Clerk authentication at the edge. Next.js looks for `middleware.ts` by default.

### Decision
The middleware file is named `proxy.ts`, not `middleware.ts`. This is configured explicitly in `next.config.ts`. Creating a `middleware.ts` file is a hard constraint violation.

### Why not middleware.ts
During early development, a naming conflict or accidental creation of `middleware.ts` alongside `proxy.ts` caused two middleware files to run simultaneously, producing unpredictable auth behaviour. Renaming to `proxy.ts` makes the unconventional choice explicit and prevents accidental recreation.

### Consequences

**Benefits:**
- Eliminates the risk of a second middleware file silently overriding or conflicting with Clerk auth
- The unconventional name is a forcing function — any developer who tries to add `middleware.ts` will notice the project already has middleware

**Risks:**
- Non-standard — developers unfamiliar with the codebase will not find middleware in the expected location
- Next.js documentation and tooling assume `middleware.ts`

**Mitigations:**
- Documented as the first hard constraint in CLAUDE.md
- `next.config.ts` explicitly points to `proxy.ts`

---

## ADR-007 — Unified Payments Table with Entity Check Constraint

**Date:** 2026-03
**Status:** Active

### Context
Initially the system had a separate `trip_payments` table for trip-related payments. When merchandise payments (payable items) were introduced, a second payments table was considered. Instead, both were unified.

### Decision
A single `payments` table handles all payment types. The entity type (trip vs. payable item) is determined by which FK column is non-null. A DB-level check constraint enforces that exactly one is non-null: `CHECK (num_nonnulls(trip_id, payable_item_id) = 1)`.

### Consequences

**Benefits:**
- Single query surface for all payment reporting and admin review
- Dual-approval logic, RLS policies, and audit trail apply uniformly to all payment types
- Adding a third entity type (e.g., event tickets) requires only a new FK column and constraint update, not a new table

**Risks:**
- PostgREST join ambiguity — `payments` has two FKs to `profiles` (`profile_id` + `logged_by_admin`). Any PostgREST `.select()` that joins profiles must use the FK hint `profiles!profile_id(...)` or the query returns 500
- The entity constraint means API routes must be careful not to pass both IDs or neither

**Mitigations:**
- FK ambiguity is documented as a hard gotcha in CLAUDE.md
- API routes validate the entity input before inserting
- `trip_payments` table was dropped in migration `v1.9.3` — there is no fallback to the old table

---

## ADR-008 — Strict TranslationKey Union over i18n Library

**Date:** 2026-03
**Status:** Active

### Context
The application displays UI text in two locales (English, Bulgarian). Options: a full i18n library (next-intl, react-i18next), a loose key-value map, or a strict TypeScript union type over a flat translations object.

### Decision
`lib/i18n/translations.ts` exports a flat object. `TranslationKey = keyof typeof translations` is a strict union. The `t()` helper accepts only `TranslationKey`. Any call to `t()` with an unknown key is a compile-time error. Navigation labels use a separate inline `{ en, bg }` system in `lib/nav.ts` and are not routed through `t()`.

### Why not a library
next-intl and react-i18next both require: a provider wrapping the app, locale detection/routing config, message file loading, and a runtime `useTranslations()` hook. For two locales and a controlled vocabulary, this is configuration overhead with no material benefit. The strict union provides the same compile-time safety (unknown keys break the build) with zero runtime config.

### Consequences

**Benefits:**
- Unknown translation keys break the build — no silent missing-text bugs in production
- Zero library dependency, zero provider config, zero locale routing
- Adding a translation requires one line in `translations.ts` — immediately type-safe

**Risks:**
- Adding a third locale (e.g., Slovak) requires updating every translation key — no fallback chain
- Nav labels use a separate system, so the translation surface is split across two files

**Mitigations:**
- The split is explicit and documented here. Nav labels in `lib/nav.ts`, UI strings in `translations.ts`.
- If a third locale is needed, this ADR is the decision point for whether to migrate to a library.

---

## ADR-009 — Dual-Layout Pattern (Two Complete Layouts, Not Responsive)

**Date:** 2026-03
**Status:** Active

### Context
Pages need to render correctly on both desktop (1024px+) and mobile (390px+). Options: a single responsive layout using breakpoint utilities, or two separate complete layout trees with `hidden md:block` / `md:hidden`.

### Decision
Every page that has meaningfully different desktop and mobile UX uses two separate complete layout trees. No hybrid responsive layout. Canonical reference: `app/(dashboard)/about/page.tsx`.

### Why not a single responsive layout
Desktop and mobile UX contracts for this application are fundamentally different: navigation pattern (persistent header nav vs. hamburger), content density (multi-column bento grid vs. stacked single column), and component behaviour (popovers vs. bottom sheets in `EventPopup`). A single responsive layout that satisfies both produces compromises on both. Two complete layouts make each contract explicit and independently maintainable.

### Consequences

**Benefits:**
- Each layout is independently readable — no mental model of "at md this collapses, at lg this hides"
- Component behaviour can differ completely between layouts without conditional logic
- Adding a new page requires a deliberate layout decision, not a default

**Risks:**
- Content duplication — the same data is often passed to both layout trees
- Two trees to update when shared content changes

**Mitigations:**
- Data fetching is shared (RSC or TanStack Query); only the presentation layer is duplicated
- The canonical reference page makes the pattern immediately copyable
- The Hard Constraint in CLAUDE.md prevents drift back to hybrid responsive

---

## ADR-010 — 12-Column CSS Grid for BentoGrid (Not a Component Library)

**Date:** 2026-03
**Status:** Active

### Context
The homepage and `/profile` use a tile-based layout with precise, non-standard column spans (col-2, col-3, col-4, col-6, col-12 in the same row). Options: a component library grid (shadcn, MUI Grid, CSS Grid wrappers), or a direct CSS Grid implementation.

### Decision
`BentoGrid` is a direct CSS Grid implementation: `grid-template-columns: repeat(12, 1fr)`, `gap: 12px`, `auto-rows: minmax(120px, auto)`. Column spans are applied via inline `style` or Tailwind `col-span-*` utilities. No component library grid is used.

### Why not a component library
shadcn/ui does not ship a grid layout primitive. MUI Grid and similar impose a DOM structure, className conventions, and breakpoint systems that conflict with Tailwind v4's utility-first approach. The homepage grid has spans (col-2, col-3 in the same row) that most library grids cannot express without workarounds. A direct CSS Grid is zero-cost at runtime, has no API surface to learn, and expresses the exact layout intent.

### Consequences

**Benefits:**
- Zero runtime cost — pure CSS
- Any column span expressible without library constraints
- No version lock on a grid library
- `grid-column` is directly inspectable in devtools

**Risks:**
- No built-in responsive behaviour — mobile layout requires explicit `.bento-mobile-full` / `.bento-mobile-half` CSS classes
- `rowSpan` prop must be accepted and applied by every client tile component or the grid collapses

**Mitigations:**
- Mobile override classes are defined in `globals.css` and documented in LOOKUP.md §4
- `rowSpan` requirement is a code review gate — any new tile that doesn't accept it is caught before merge
- This ADR is the decision point if shadcn/ui is ever proposed: its grid limitations are the reason it was not adopted

---

## ADR-011 — RLS as Defence-in-Depth; Canonical Policy Pattern Uses Clerk JWT Helper Functions

**Date:** 2026-03
**Status:** Active

### Context
RLS is enabled on all 19 public tables. Policies exist on all tables. However, two distinct policy patterns have accumulated across the codebase, and their relationship to the ADR-002 service-role decision needed to be formally mapped.

### Audit Results (2026-03-26)

All 19 tables have `rowsecurity = true`. Policy coverage is complete — no table is unprotected.

| Table | RLS Enabled | Policy pattern | Commands covered |
|---|---|---|---|
| `profiles` | ✅ | Pattern A (helper functions) | SELECT (own + downline + admin), UPDATE (own + admin), ALL (admin) |
| `notifications` | ✅ | Pattern A | SELECT (own, deleted_at IS NULL), UPDATE (own), ALL (admin) |
| `payments` | ✅ | Pattern A + raw JWT sub | SELECT (own), INSERT (own, logged_by_admin guard), UPDATE (admin-logged only), ALL (admin+core) |
| `trip_registrations` | ✅ | Pattern A | SELECT (own), INSERT (own), ALL (admin) |
| `event_role_requests` | ✅ | Pattern A | SELECT (own), INSERT (own), ALL (admin) |
| `abo_verification_requests` | ✅ | Pattern A | SELECT (own), INSERT (own), DELETE (own pending) |
| `announcements` | ✅ | Pattern A | SELECT (active + role match), ALL (admin) |
| `calendar_events` | ✅ | Pattern A | SELECT (N21 public, Personal member+), ALL (admin) |
| `quick_links` | ✅ | Pattern A | SELECT (role match), ALL (admin) |
| `home_settings` | ✅ | Pattern A | SELECT (true), ALL (admin) |
| `trips` | ✅ | Pattern A | SELECT (member+), ALL (admin) |
| `tree_nodes` | ✅ | Pattern A | SELECT (own subtree + admin), ALL (admin) |
| `los_members` | ✅ | Pattern A | SELECT (own ABO match), ALL (admin) |
| `guides` | ✅ | **Pattern B** (`auth.jwt() ->> 'user_role'`) | SELECT (published + role, or admin/core), INSERT/UPDATE/DELETE (admin) |
| `bento_config` | ✅ | **Pattern B** (`auth.jwt() ->> 'user_role'`) | SELECT (authenticated), UPDATE (admin) |
| `social_posts` | ✅ | **Pattern B** (`auth.jwt() ->> 'user_role'`) | SELECT (authenticated), INSERT/UPDATE/DELETE (admin) |
| `member_vital_signs` | ✅ | **Pattern B** (mixed: `auth.jwt() ->> 'sub'` + `auth.jwt() ->> 'user_role'`) | SELECT (own profile_id or admin), INSERT/DELETE (admin) |
| `vital_sign_definitions` | ✅ | **Pattern B** (`auth.jwt() ->> 'user_role'`) | SELECT (authenticated), INSERT/UPDATE/DELETE (admin) |
| `payable_items` | ✅ | **Pattern B** (`auth.jwt() ->> 'user_role'`) | SELECT (active, all), ALL (admin+core) |

### The Two Patterns

**Pattern A — canonical, uses project helper functions:**
```sql
-- Role check
is_admin()                          -- wraps get_my_role() = 'admin'
get_my_role()                       -- reads request.jwt.claims -> 'user_role'
-- Identity check
get_my_profile_id()                 -- subselect: profiles.clerk_id = get_my_clerk_id()
get_my_clerk_id()                   -- reads request.jwt.claims -> 'user_id'
```
These functions read the `user_id` claim from `request.jwt.claims`, which is the Clerk user ID passed via the custom JWT template.

**Pattern B — inconsistent, uses raw JWT accessors:**
```sql
auth.jwt() ->> 'user_role'          -- reads role directly from JWT (works if claim exists)
auth.jwt() ->> 'sub'                -- reads Supabase Auth subject (WRONG for Clerk users)
```
`auth.jwt() ->> 'sub'` resolves to the Supabase Auth UUID, which does not exist for Clerk-authenticated users. Any policy using `auth.jwt() ->> 'sub'` for identity matching (as in `member_vital_signs`) will never match a Clerk user. This policy is silently non-functional for its intended purpose.

### Decision
1. **RLS remains defence-in-depth** (ADR-002 unchanged). The service role is the primary access control mechanism for all server routes. RLS protects against direct DB access, future anon client usage, and Supabase Studio access.
2. **Pattern A is the canonical policy pattern** for all new and migrated policies. No new policy may use `auth.jwt() ->> 'sub'`. No new policy may use raw `auth.jwt()` accessors when a helper function covers the same check.
3. **Pattern B tables are flagged for remediation** in SEQ261–265. Priority order: `member_vital_signs` first (has a broken `sub`-based identity check), then the remaining Pattern B tables.
4. **The `member_vital_signs` SELECT policy using `auth.jwt() ->> 'sub'`** must be replaced with `get_my_profile_id()` in the remediation ticket.

### Helper Functions Reference

| Function | Reads from JWT | Returns |
|---|---|---|
| `get_my_clerk_id()` | `request.jwt.claims -> 'user_id'` | `text` (Clerk user ID) |
| `get_my_profile_id()` | via `get_my_clerk_id()` → profiles lookup | `uuid` (profiles.id) |
| `get_my_role()` | `request.jwt.claims -> 'user_role'` | `user_role` enum |
| `is_admin()` | via `get_my_role()` | `boolean` |

### Consequences

**Benefits:**
- All new policies use consistent, readable helper functions — no raw JWT path spelunking
- Broken `auth.jwt() ->> 'sub'` policies are identified and scheduled for remediation
- Defence-in-depth layer is fully mapped — no surprises if a future engineer introduces a non-service client

**Risks:**
- Pattern B tables currently have non-functional identity-matching policies (vacuous — they pass for admin role checks but fail for member-owned-row checks). This is acceptable today only because service-role bypasses all RLS. If a non-service client is ever introduced without fixing Pattern B first, member data isolation breaks silently.
- `payments` SELECT/INSERT policies use inline `auth.jwt() ->> 'sub'` for profile_id resolution — this is also Pattern B and should be migrated to `get_my_profile_id()` in SEQ263.

**Mitigations:**
- SEQ261–265 (remediation tickets) are in the backlog and unblocked after this audit
- The broken `sub`-based policy on `member_vital_signs` is explicitly called out above
- A new hard rule is added to CLAUDE.md: new RLS policies MUST use Pattern A helper functions

---

## ADR-012 — Feature-Based Folder Structure: Co-locate Route-Scoped Components

**Date:** 2026-03
**Status:** Active

### Context
All React components currently live under `/components`, regardless of how many routes consume them. The directory has grown to include feature-specific subdirectories (`components/about`, `components/admin`, `components/trips`, `components/calendar`, `components/notifications`, `components/events`) that map 1:1 to a single route or route group. Only `components/layout`, `components/bento`, and `components/ui` contain genuinely shared, cross-route components.

This creates two problems:
1. **Navigation cost.** Finding the component for a given route requires knowing it lives in a sibling directory, not the route directory.
2. **Implicit coupling.** A component in `components/trips` looks available to any route, even if extracting it would require significant interface changes.

### Decision
Components that are consumed by exactly one route (or route group) MUST live co-located inside that route's directory, in a `components/` subdirectory:

```
app/(dashboard)/trips/components/    # components only used in /trips routes
app/(dashboard)/about/components/    # components only used in /about
app/admin/members/components/        # components only used in /admin/members
```

Components used by two or more **unrelated** routes remain in `/components` under the appropriate subdirectory.

**The rule, stated precisely:**
> A new component MUST be created co-located with the route it belongs to. It MAY be promoted to `/components` only if it is subsequently consumed by a second unrelated route. No new files are added directly to `/components` or any of its subdirectories unless the component is used by 2+ unrelated routes at the time of creation.

**Existing components are not migrated by this ticket.** Migration is a separate workstream, ticket-by-ticket, and will not be retroactively applied here.

### Exempt from co-location (always in `/components`)

| Directory | Reason |
|---|---|
| `components/layout` | Header, Footer, UserDropdown, UserPopup — consumed by the root layout, applies to all routes |
| `components/bento` | BentoCard, BentoGrid — used on homepage and `/profile` (two unrelated routes) |
| `components/ui` | Drawer, Skeleton, and any future primitive UI components — explicitly cross-feature |

### Current state — directories flagged for migration in future tickets

| Current path | Target path | Scope |
|---|---|---|
| `components/about` | `app/(dashboard)/about/components` | Single route |
| `components/admin` | `app/admin/[subroute]/components` per subroute | Admin route group |
| `components/trips` | `app/(dashboard)/trips/components` | Trips route group |
| `components/calendar` | `app/(dashboard)/calendar/components` (if member-only) or stays shared | Check usage |
| `components/events` | `app/(dashboard)/[route]/components` (check which routes use EventPopup) | Check usage |
| `components/notifications` | `app/(dashboard)/[route]/components` or stays shared | Check usage |

Migration tickets must verify import usage before moving any file.

### Why not leave everything in `/components`
The flat `/components` structure works until it doesn't. The tipping point is reached when the component count makes it unclear whether a given component is safe to modify (it might be used by more routes than expected) or where to look for a route-specific component. The `/components/admin` subdirectory already has multiple components that are admin-only — keeping them there provides no meaningful sharing benefit.

### Consequences

**Benefits:**
- Route directory is self-contained — all code relevant to a route is in one place
- Reduced surface area for unintended coupling between features
- Deleting a route is now a single directory deletion, not a hunt across `/components`

**Risks:**
- Two locations for components until migration is complete — developers must know the rule to find the right place
- Promoting a co-located component to `/components` requires a move + import update across all consumers

**Mitigations:**
- The rule is in CLAUDE.md: new components follow co-location from today. Migration is incremental.
- The "2+ unrelated routes" promotion bar is explicit — no ambiguity about when to promote
- `components/layout`, `components/bento`, and `components/ui` are permanently exempt and documented as such

---

## ADR-013 — shadcn/ui as the Mandatory Primitive Library for Interactive Components

**Date:** 2026-03
**Status:** Active

### Context
Before this decision, interactive primitives (drawers, dropdowns, popovers, dialogs, tooltips, selects) were hand-rolled components. Hand-rolled primitives consistently lack: correct focus trapping, Escape-key handling, ARIA attributes, scroll-lock on mobile, and portal rendering to avoid z-index collisions. These defects are non-obvious and do not cause test failures — they surface as accessibility regressions and mobile UX bugs.

shadcn/ui was installed in SEQ247 (commit ff0da51). It wraps Radix UI primitives, which are headless and fully accessible by default. The component source is vended directly into `components/ui/` — it is owned code, not a runtime dependency.

### Decision
Any new interactive primitive — dialog, popover, dropdown menu, sheet, tooltip, select, combobox, alert dialog — **MUST** use the corresponding shadcn/ui component. Hand-rolling an equivalent is prohibited.

Existing hand-rolled components (`Drawer.tsx`, `UserDropdown`, `UserPopup`, `NotificationPopup`, `EventPopup`) are scheduled for migration in SEQ267–271. Until migrated, they remain in place; do not extend them.

### Why shadcn/ui over other options
- **Radix UI primitives** (what shadcn wraps) handle focus trap, ARIA, keyboard nav, and scroll-lock correctly by default — these are non-trivial to implement correctly by hand.
- **Owned source** — `npx shadcn@latest add <component>` copies the component source into `components/ui/`. There is no runtime dependency on shadcn; Radix UI packages are the only addition to `node_modules`. The component can be modified freely.
- **Tailwind-styled** — styling uses the same Tailwind utility classes already in the project. No CSS module conflicts, no CSS-in-JS.
- **Not a grid library** — ADR-010 explicitly excluded shadcn from layout primitives. This ADR applies only to interactive components. The BentoGrid is not affected.

### Scope

| Primitive | shadcn component | Install command |
|---|---|---|
| Modal/dialog | `Dialog` | `npx shadcn@latest add dialog` |
| Slide-in panel | `Sheet` | `npx shadcn@latest add sheet` |
| Anchored overlay | `Popover` | `npx shadcn@latest add popover` |
| Dropdown menu | `DropdownMenu` | `npx shadcn@latest add dropdown-menu` |
| Destructive confirm | `AlertDialog` | `npx shadcn@latest add alert-dialog` |
| Option selector | `Select` | `npx shadcn@latest add select` |
| Searchable selector | `Combobox` | `npx shadcn@latest add command` + popover |
| Hover hint | `Tooltip` | `npx shadcn@latest add tooltip` |

### Installation note
`npx shadcn@latest init` was intentionally NOT run in SEQ247 — the CLI assumes Tailwind v3 and would have corrupted `globals.css`. Components are added individually via `npx shadcn@latest add <n>`, which only touches `components/ui/`. This is the correct workflow for this stack.

### Consequences

**Benefits:**
- Focus trap, Escape-to-close, ARIA roles, and scroll-lock are correct by default on all new interactive components
- Consistent keyboard navigation across all interactive surfaces
- Reduced per-ticket scope — interactive behaviour is handled by Radix; only styling and props need attention
- Mobile layout law (390px) is easier to satisfy — Sheet slides from bottom on mobile by default

**Risks:**
- shadcn components inject CSS variables into `globals.css` on install if not carefully reviewed — must be checked against `brand-tokens.css` after each `add`
- Radix portals render outside the React tree, which can cause z-index conflicts with the Mapbox map canvas on pages that have both
- The Tailwind v4 / shadcn CSS variable system has a known friction point: shadcn expects `--background`, `--foreground`, etc., which may conflict with existing `--bg-global`, `--text-primary` tokens

**Mitigations:**
- After every `npx shadcn@latest add`, review the diff in `globals.css` before committing — revert any injected `@layer base` blocks that conflict with `brand-tokens.css`
- Z-index conflict with Mapbox: use `style={{ zIndex: 50 }}` on the portal container if a shadcn overlay appears behind the map canvas
- CSS variable naming conflict: shadcn components in `components/ui/` can be edited post-install to reference project tokens (`var(--bg-card)` instead of `var(--card)`) — this is expected and permitted

---

## ADR-014 — Cookie-Based Transport for UI Preference Synchronisation

**Date:** 2026-03-28
**Status:** Active

### Context
The font-size scaling feature (SEQ272–274) requires UI preferences to be applied before first paint to avoid a flash of unstyled/wrong-size content (FOUC). Two approaches were evaluated:

**Option A — `localStorage` + inline blocking script:**
Write the preference to `localStorage` on mutation. On every page load, inject a synchronous `<script>` in `<head>` that reads `localStorage` and applies the `data-font-size` attribute to `<html>` before the browser paints. Requires `suppressHydrationWarning` on `<html>` because the server renders a different attribute value than the client script sets.

**Option B — Cookie as boot transport (chosen):**
Write a lightweight cookie (`tevd-font-size`) on mutation. `app/layout.tsx` reads the cookie server-side via `cookies()` from `next/headers` and applies `data-font-size` directly to `<html>` in the server-rendered HTML. No inline script needed. No hydration mismatch — server and client render identical HTML.

### The flaw in Option A
`localStorage` is device-local and not available on the server. This means:
- A user with preference `lg` who logs in on a new device gets no cookie, no `localStorage` entry, and no inline script value — the page renders `md`, then shifts to `lg` after `useFontSize` mounts and fetches `ui_prefs`. This is a FOUC on every new device, every incognito session, and every cache clear.
- More critically: the tevd-portal root layout is already dynamic because `clerkMiddleware` in `proxy.ts` reads session cookies on every request. Avoiding a server-side cookie read to "prevent making the layout dynamic" is a false optimisation — the layout is already dynamic. Option A pays the dynamic rendering tax without the UX benefit.

### Decision
UI preferences that affect the initial render (font size, and any future cosmetic preferences) use a cookie as the boot transport layer:

1. **Source of truth:** `profiles.ui_prefs` (JSONB). Cross-device, persisted in the database.
2. **Boot transport:** A named cookie (e.g., `tevd-font-size=lg`). Device-local. Set by the client on mutation. Read by `app/layout.tsx` on every request.
3. **SSR execution:** `app/layout.tsx` reads the cookie via `cookies()` and applies the `data-*` attribute to `<html>`. Server and client render identical HTML. No `suppressHydrationWarning`.
4. **Mutation:** Client updates DOM attribute → writes cookie → PATCHes `/api/profile` (fire and forget).
5. **Cross-device reconciliation:** `useFontSize` hook reads `ui_prefs` from the profile API on mount. If it differs from the current DOM attribute (which reflects the cookie), it reconciles: updates DOM and overwrites the cookie. This is the one-time sync path for new devices.

**Do not use `localStorage` for any preference that needs to be applied at SSR time.** See Consequences.

### FOUC Contract

| Scenario | Outcome |
|---|---|
| Returning user, same device | ✅ Zero FOUC. Cookie present → server renders correct attribute. |
| Returning user, new device / incognito | ⚠️ One-time FOUC on first load only. Server renders `md` (no cookie) → hook reconciles after profile fetch → cookie set → all subsequent loads FOUC-free. |
| Mutation | ✅ Immediate DOM update (optimistic). Cookie written synchronously. |
| Cookie tampered / invalid value | ✅ `app/layout.tsx` validates and falls back to `'md'`. |

The one-time new-device FOUC is an **accepted engineering tradeoff**. Eliminating it would require a blocking DB read in the root layout on every request to resolve `ui_prefs` without a client round-trip — an anti-pattern for a purely cosmetic preference.

### Responsibility Boundaries

| Layer | Owns |
|---|---|
| `app/layout.tsx` | Reads cookie. Applies `data-*` attribute to `<html>`. Validates value. |
| `useFontSize` hook | Reads `ui_prefs` from API. Reconciles DOM on mount if cookie differs. Writes cookie on mutation. PATCHes `/api/profile`. |
| `/api/profile` PATCH | Merges preference key into `ui_prefs` JSONB without clobbering other keys. |

Full sequence diagram: `docs/architecture/ui-state-sync.md`.

### Extending This Pattern
Any future cosmetic preference that must be applied at SSR time follows this same pattern: named cookie + `app/layout.tsx` read + dedicated hook. Do not use `localStorage`. Do not use inline `<script>` tags in `<head>`.

### Consequences

**Benefits:**
- Zero FOUC for all returning sessions on any device
- No inline script tag in `<head>` — no HTML parser blocking
- No `suppressHydrationWarning` — server and client agree on the rendered HTML
- Pattern is straightforward to extend to future preferences
- Exploits the existing dynamic rendering cost of Clerk auth — no additional infrastructure cost

**Risks:**
- One-time FOUC on first login per device is unavoidable without a blocking DB read (accepted)
- Cookie is device-local — cross-device sync depends on `useFontSize` reconciliation after profile load
- Cookie can be cleared by the user; the next load will FOUC once and re-sync (acceptable — same as new device)

**Mitigations:**
- The one-time FOUC is documented as accepted in this ADR and in `docs/architecture/ui-state-sync.md`
- Cookie validation in `app/layout.tsx` prevents injection of arbitrary `data-font-size` values
- `useFontSize` reconciliation on mount ensures `ui_prefs` always wins over a stale or missing cookie
