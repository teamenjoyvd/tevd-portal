# CONTEXT.md — N21 Community & LOS Management Portal (teamenjoyVD)
> Last updated: March 2026 — post v1.0.0 stable release

---

## 1. Project Overview & Operational Rules

Internal management portal for **teamenjoyVD (N21 Community)** handling Line of Sponsorship (LOS) data, team coordination, event scheduling, and trip logistics.

**Role:** Senior technical collaborator. Direct, peer-to-peer communication.

### Core Rules
- **Zero-Refactor Rule:** No logic cleanup, DRYing, or unsolicited refactoring.
- **Scope Adherence:** Preserve original line counts, formatting, and logic in all untouched areas.
- **Git Strategy:** Every development session concludes with a single `git add . && git commit -m "..." && git push origin main` command following `.gitmessage` conventions.

---

## 2. Tech Stack & Infrastructure

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Turbopack enabled |
| Auth | Clerk | Gmail accounts. Custom JWT template for Supabase RLS. `afterSignOutUrl` configured at `ClerkProvider` level, not `UserButton`. |
| Database | Supabase (PostgreSQL 17) | DB only. RLS enabled. LTree + pg_cron + pg_net extensions active. |
| State & Data Fetching | TanStack Query v5 | `QueryClientProvider` in `app/providers.tsx`. 15s polling for notifications. |
| Styling | Tailwind CSS | Mobile-first. Font variables registered in `tailwind.config.ts`. |
| Fonts | Playfair Display (serif) + Montserrat (sans) | Loaded via `next/font/google` with cyrillic subsets. CSS vars: `--font-playfair`, `--font-montserrat`. |
| Calendar API | Google Calendar API | Service account auth. Credentials stored as Edge Function env secrets (not Vault). |
| Background Jobs | Supabase Edge Function + pg_cron | `sync-google-calendar` Edge Function, hourly cron (job ID 1). |
| Deployment | Vercel | Team: `teamenjoyvd`. Project: `tevd-portal` (`prj_HFZJZg2vkLtpX8XvjJlo3mDkSCyn`). |

### Key Infrastructure IDs
- Supabase project: `ynykjpnetfwqzdnsgkkg` (eu-west-1)
- Vercel team: `team_1vvskKJStqVCZsgxXlw3FwZH`
- Edge Function: `sync-google-calendar` (verify_jwt: false, auth via `x-sync-secret` header)
- pg_cron job: `sync-google-calendar`, schedule `0 * * * *`, job ID 1

---

## 3. Repository & Deployment

- **Repo:** `https://github.com/teamenjoyvd/tevd-portal.git` (private)
- **Production:** `https://tevd-portal.vercel.app`
- **Branch strategy:** single `main` branch, deploy on push

### Environment Variables

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel + `.env.local` |
| `CLERK_SECRET_KEY` | Vercel + `.env.local` |
| `CLERK_WEBHOOK_SECRET` | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` |
| `SYNC_SECRET` | Vercel + `.env.local` + Edge Function secrets |

### Edge Function Secrets (Supabase Dashboard)
```
GOOGLE_SERVICE_ACCOUNT = <full JSON string>
GOOGLE_CALENDAR_ID     = teamenjoyvd@gmail.com
SYNC_SECRET            = tevd_sync_secret_2026
```

---

## 4. Project Directory Structure

```
/app
  /layout.tsx                    # ClerkProvider + Providers + fonts
  /providers.tsx                 # TanStack QueryClientProvider
  /globals.css
  /(auth)
    /sign-in/[[...sign-in]]/page.tsx
    /sign-up/[[...sign-up]]/page.tsx
  /(dashboard)
    /layout.tsx                  # Header + BottomNav + pb-20 mobile
    /page.tsx                    # Home — hero, carets, events, announcements, links
    /calendar/page.tsx           # N21 calendar, month nav, ISO week numbers
    /trips/page.tsx              # Trips placeholder
    /profile/page.tsx            # Profile + doc toggle + expiry logic
    /notifications/page.tsx      # Persistent audit log
  /admin
    /layout.tsx                  # Server-side admin gate + nav
    /page.tsx                    # Redirects to /admin/approval-hub
    /approval-hub/page.tsx       # Pending/resolved registrations
    /content/page.tsx            # Announcements + quick links + home settings
    /operations/page.tsx         # Trip creation + EUR milestones
    /data-center/page.tsx        # LOS CSV import + preview
  /api
    /webhooks/clerk/route.ts     # user.created/updated/deleted → profiles upsert
    /profile/route.ts            # GET + PATCH own profile
    /calendar/route.ts           # GET events (guest-safe, N21 only for unauth)
    /home/route.ts               # Parallel fetch of all home page data
    /notifications/route.ts      # GET all + GET ?count=true
    /notifications/[id]/route.ts # PATCH mark read
    /notifications/read-all/route.ts
    /trips/route.ts              # GET all + POST create (admin)
    /trips/[id]/route.ts         # GET, PATCH, DELETE
    /trips/[id]/register/route.ts
    /trips/[id]/registrations/route.ts
    /trips/[id]/payments/route.ts
    /admin/los-import/route.ts   # POST CSV import → import_los_members RPC
    /admin/los-tree/route.ts     # GET full tree with profiles
    /admin/calendar-sync/route.ts # POST manual sync trigger
    /admin/registrations/[id]/route.ts # PATCH approve/deny
    /admin/payments/route.ts     # POST manual payment override
    /admin/announcements/route.ts + [id]/route.ts
    /admin/quick-links/route.ts  + [id]/route.ts
    /admin/home-settings/route.ts
/components
  /layout
    /Header.tsx                  # Sticky Forest header, bell + unread badge, UserButton
    /BottomNav.tsx               # Fixed mobile bottom nav (hidden md+)
/lib
  /supabase
    /server.ts                   # createClient() — async, awaits cookies()
    /client.ts                   # createBrowserClient()
    /service.ts                  # createServiceClient() — service role
  /hooks
    /useNotifications.ts         # useNotifications, useUnreadCount (15s poll),
                                 # useMarkRead, useMarkAllRead (optimistic)
/types
  /supabase.ts                   # Generated from live schema — regenerate after migrations
  /index.ts                      # Shared app interfaces
/supabase
  /functions
    /sync-google-calendar/index.ts  # Edge Function source (deploy via CLI or dashboard)
/public
/proxy.ts                        # Next.js 16 proxy (replaces middleware.ts)
/tailwind.config.ts
```

---

## 5. Visual Identity & UX

**Style:** Luxury Modern. Mobile-first.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| Eggshell | `#f4f1de` | Main backgrounds / card surfaces |
| Forest | `#2d332a` | Dark headers / nav |
| Deep | `#3d405b` | Primary text / dark surfaces |
| Crimson | `#bc4749` | Primary branding / CTAs / notification badges |
| Sienna | `#e07a5f` | Secondary buttons / accents / active nav |
| Stone | `#8e8b82` | UI elements / borders / muted text |
| Sage | `#81b29a` | Success / approved states |
| Sandy | `#f2cc8f` | Warnings / pending / highlights |

All colors registered in `tailwind.config.ts` as named tokens (e.g. `bg-crimson`, `text-stone`).

### Typography
- **Headings:** Playfair Display (`font-serif`) — Elegant, authoritative
- **Body & Data:** Montserrat (`font-sans`) — Clean, geometric, mobile-optimized
- Both loaded with `latin` + `cyrillic` subsets for Bulgarian support

### Mobile UX
- `BottomNav`: fixed, 4 items (Home, Calendar, Trips, Profile), hidden on `md+`, hidden on auth/admin routes
- `Header`: sticky, Forest background, bell + unread badge, UserButton
- `pb-20` on dashboard main content to clear bottom nav
- High-contrast cards: Eggshell surfaces on Stone borders

---

## 6. Auth & JWT Architecture

### Clerk Setup
- Gmail accounts only (no Workspace required)
- Custom JWT template named `supabase`:
  ```json
  {
    "user_id": "{{user.id}}",
    "user_role": "{{user.public_metadata.role}}",
    "abo_number": "{{user.public_metadata.abo_number}}"
  }
  ```
- Note: `sub` is a reserved JWT claim — use `user_id` instead
- Custom signing key: **OFF** (Clerk signs with Supabase JWT secret automatically)
- `afterSignOutUrl="/"` configured at `ClerkProvider` level in `app/layout.tsx`

### Clerk Webhook
- Endpoint: `POST /api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`
- Upserts `profiles` row on `clerk_id` conflict
- Reads `role` and `abo_number` from Clerk `public_metadata`
- Verified via `svix` package

### First Admin Setup
- Create account via `/sign-up`
- In Clerk Dashboard → Users → your account → Public metadata:
  ```json
  { "role": "admin" }
  ```
- Admin `abo_number` is `null` — system users exist outside the LOS tree

### RLS Helper Functions
```sql
get_my_clerk_id()    -- reads 'user_id' from JWT claims
get_my_profile_id()  -- looks up profiles.id by clerk_id
get_my_role()        -- reads 'user_role' from JWT claims
is_admin()           -- role = 'admin'
```

---

## 7. Database Schema

### Migrations (in order)

| Version | Name |
|---|---|
| 20260315122053 | enable_extensions |
| 20260315122103 | core_types_and_profiles |
| 20260315122119 | los_events_trips |
| 20260315122130 | cms_notifications_quicklinks |
| 20260315122154 | rls_policies_and_clerk_jwt |
| 20260315123909 | fix_clerk_jwt_helpers |
| 20260315145410 | ltree_path_builder_and_triggers |
| 20260315145429 | los_import_rpc |
| 20260315163532 | pg_cron_calendar_sync |
| 20260315171202 | vault_read_secrets_rpc |
| 20260315172309 | trips_notification_triggers |
| 20260315175935 | doc_expiry_notification_trigger |

### Extensions Active
`ltree`, `pg_cron`, `pg_net`, `uuid-ossp`, `pgcrypto`, `supabase_vault`

### Core Types

```sql
user_role:             admin | core | member | guest
document_type:         id | passport
registration_status:   pending | approved | denied
payment_status:        completed | pending | failed
notification_type:     role_request | trip_request | trip_created | event_fetched | doc_expiry
event_category:        N21 | Personal
```

### TypeScript Interfaces

```ts
type Role = 'admin' | 'core' | 'member' | 'guest'

interface Profile {
  id: string                          // UUID
  clerk_id: string
  abo_number: string | null           // NULL for system admin
  role: Role
  first_name: string
  last_name: string
  display_names: Record<string, string>  // { "en": "...", "bg": "...", "sk": "..." }
  document_active_type: 'id' | 'passport'
  id_number: string | null
  passport_number: string | null
  valid_through: string | null        // ISO date
  created_at: string
}

interface TreeNode {
  id: string
  profile_id: string
  parent_id: string | null
  path: string                        // LTree path
  depth: number
}

interface LOSMember {
  abo_number: string                  // PK + CSV upsert conflict target
  sponsor_abo_number: string | null
  abo_level: string
  country: string
  name: string
  entry_date: string
  phone: string
  email: string
  address: string
  renewal_date: string
  gpv: number; ppv: number; bonus_percent: number; gbv: number
  customer_pv: number; ruby_pv: number; customers: number
  points_to_next_level: number; qualified_legs: number; group_size: number
  personal_order_count: number; group_orders_count: number
  sponsoring: number; annual_ppv: number
  last_synced_at: string
}

interface CalendarEvent {
  id: string
  google_event_id: string | null
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  visibility_roles: Role[]
  week_number: number               // ISO week — mandatory on all views
}

interface Trip {
  id: string
  title: string; destination: string; description: string
  image_url: string | null
  start_date: string; end_date: string
  currency: 'EUR'                   // DB check constraint — cannot be changed
  total_cost: number
  milestones: TripMilestone[]       // JSONB
}

interface TripMilestone {
  label: string; amount: number; due_date: string
}

interface TripRegistration {
  id: string; trip_id: string; profile_id: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
}

interface TripPayment {
  id: string; trip_id: string; profile_id: string
  amount: number; transaction_date: string
  status: 'completed' | 'pending' | 'failed'
  note: string | null
}

interface Notification {
  id: string; profile_id: string
  is_read: boolean                  // Never deleted — audit log
  type: 'role_request' | 'trip_request' | 'trip_created' | 'event_fetched' | 'doc_expiry'
  title: string; message: string
  action_url: string | null
  created_at: string
}

interface Announcement {
  id: string
  titles: Record<string, string>    // Multi-lang JSONB
  contents: Record<string, string>  // Multi-lang JSONB
  access_level: Role[]
  is_active: boolean
  created_at: string
}

interface QuickLink {
  id: string; label: string; url: string
  access_level: Role[]; icon_name: string; sort_order: number
}

interface HomeSettings {
  id: string
  show_caret_1: boolean; caret_1_text: string
  show_caret_2: boolean; caret_2_text: string
  show_caret_3: boolean; caret_3_text: string
  featured_announcement_id: string | null
  updated_at: string
}
```

---

## 8. Core Module Logic

### 8.1 LOS Hierarchy & Data Sync

- **Structure:** Adjacency List + LTree. `tree_nodes.path` e.g. `7010970187.7023040472`
- **Import:** CSV upsert via `import_los_members(rows jsonb)` RPC (security definer). Conflict target: `abo_number`.
- **Path rebuild:** `rebuild_tree_paths()` called after every import. Runs up to 10 passes to handle ordering.
- **RLS:** `path <@ viewer.path` — members see themselves and downline only.
- **Admin bypass:** `abo_number = null` + explicit `is_admin()` check in all policies. Never rely on NULL LTree behaviour.
- **CSV format:** Amway export. Parser skips rows 1-2 (Amway metadata), finds header at first line containing "ABO Number". Known quirks:
  - `Bonus Percent` has `%` suffix — stripped by parser
  - `Renewal Date` is `"DD Month YYYY"` format — parsed to ISO
  - `Phone` has `"Primary: "` prefix — stripped
  - ` Customers` has leading space in header

### 8.2 Calendar & Events

- **Sync:** `sync-google-calendar` Edge Function, called by pg_cron hourly
- **Auth:** Service account JWT signed with Web Crypto API (no external deps). Credentials in Edge Function env secrets.
- **Category routing:** Events with `[Personal]` in title or description → `Personal` category, else `N21`
- **Visibility:** N21 = all roles including guest. Personal = member/core/admin only.
- **Week numbers:** ISO week calculated on sync, stored in `calendar_events.week_number`. Mandatory on all UI views.
- **Manual trigger:** `POST /api/admin/calendar-sync` — admin only, calls Edge Function with `x-sync-secret` header
- **Notifications:** `event_fetched` notification inserted for all member/core/admin profiles on new events

### 8.3 Trip & Financial Management

- **Workflow:** Member requests → DB trigger notifies admins → Admin approves/denies via Approval Hub → DB trigger notifies member
- **Optimistic UI:** TanStack Query `onMutate`/`onError`/`onSettled` pattern. Approval Hub invalidates both `registrations` and `notifications` cache keys on settle.
- **Currency:** EUR only. `CHECK (currency = 'EUR')` constraint at DB level.
- **Milestones:** JSONB array on `trips` table. Tracked against `trip_payments`.

### 8.4 Notifications (Persistent Audit Log)

- **Never deleted.** `is_read = true` removes from badge count only.
- **Bell badge:** `useUnreadCount()` hook, 15s polling via `refetchInterval`
- **Optimistic updates:** `useMarkRead` and `useMarkAllRead` update both `['notifications']` and `['notifications', 'unread-count']` cache keys simultaneously

### 8.5 Document Safety & Expiry

- **Toggle:** `document_active_type` persisted to DB on click (not just local state)
- **Expiry states:**
  - `ok`: > 6 months — Sage/green indicator
  - `warning`: < 6 months — Sandy/amber indicator
  - `critical`: < 3 months or expired — Crimson indicator
- **Trigger:** `on_profile_doc_expiry_check` fires on `valid_through` update, inserts `doc_expiry` notification if within 6 months
- **Check:** Both client (UI state) and server (trigger) enforce the logic

---

## 9. TanStack Query Key Taxonomy

```
['profile']
['notifications']
['notifications', 'unread-count']
['events', 'YYYY-MM']
['trips']
['registrations', 'all']
['registrations', 'user', profileId]
['announcements']
['quick-links']
['home-settings']
```

---

## 10. Site Map & Routing

### User Interface (`/app/(dashboard)/...`)

| Route | Description |
|---|---|
| `/` | Hero, carets, next 3 N21 events, announcements, quick links |
| `/calendar` | Month nav, N21 events grouped by date, ISO week numbers |
| `/trips` | Placeholder — trip booking UI pending |
| `/profile` | Core data, doc toggle, expiry warning |
| `/notifications` | Persistent audit log, mark read, 15s poll |

### Auth (`/app/(auth)/...`)

| Route | Description |
|---|---|
| `/sign-in` | Clerk `<SignIn />` |
| `/sign-up` | Clerk `<SignUp />` |

### Admin Interface (`/app/admin/...`)
Server-side admin gate in `app/admin/layout.tsx` — redirects to `/sign-in` if unauth, `/` if not admin.

| Route | Description |
|---|---|
| `/admin` | Redirects to `/admin/approval-hub` |
| `/admin/approval-hub` | Trip registration queue — approve/deny with optimistic UI |
| `/admin/operations` | Trip creation, EUR milestones |
| `/admin/content` | Announcements (EN/BG/SK), quick links, home carets |
| `/admin/data-center` | LOS CSV import, preview table, upsert + LTree rebuild |

---

## 11. Known Decisions & Gotchas

| Topic | Decision | Reason |
|---|---|---|
| Supabase Edge Function deploy | Via dashboard editor or Supabase CLI — not MCP | MCP deploy tool registers new version numbers but does not update function code (same sha256 hash across versions) |
| Vault vs Edge Function secrets | Credentials in Edge Function env secrets | `vault.decrypted_secrets` not accessible via `supabase-js` `.from()` notation — requires raw SQL. Edge Function secrets are simpler and equally secure. |
| `vault_read_secrets` RPC | Exists in DB but unused | Was the attempted Vault workaround — can be dropped in a future cleanup migration |
| `sub` JWT claim | Use `user_id` instead | `sub` is a reserved JWT claim — Clerk rejects it as a custom claim |
| `afterSignOutUrl` | Set on `ClerkProvider`, not `UserButton` | Removed from `UserButton` props in Clerk v6 |
| `cookies()` in server client | Must be `await`ed | Next.js 16 made `cookies()` fully async — `createClient()` in `lib/supabase/server.ts` is async |
| `middleware.ts` | Renamed to `proxy.ts` | Next.js 16 deprecated `middleware` file convention in favour of `proxy` |
| Admin RLS bypass | Explicit `is_admin()` check | Do not rely on `abo_number = null` NULL handling in LTree operators |
| EUR currency | DB `CHECK` constraint | Enforced at database level, not just UI |

---

## 12. Pending / Next Steps

| Item | Notes |
|---|---|
| Trip booking UI | Member-facing `/trips` page — list trips, register, payment history |
| LOS import run | Upload real CSV at `/admin/data-center` |
| Profile backfill | Update admin profile first/last name + link ABO number |
| Google service account key rotation | Old key `ad81371a0cf6f3dce98240cce3b7df3d21cb9baf` should be deleted from Google Cloud Console |
| UI polish pass | Currently functional but unstyled — Phase 9 laid groundwork, full design pass pending |
| Member profile pages | Admin view of individual member profiles + LOS position |
| Event role requests | UI for members to request Speaker/Host roles on events |
| About page | `/about` — N21/team philosophy |
