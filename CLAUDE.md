# CLAUDE.md — teamenjoyVD Portal
> Last updated: 2026-03-18 — Session 5 handover. Current stable: v1.3.0 (ISS-0057, tag a6eff42).

---

## 1. Project Overview & Operational Rules

Internal management portal for **teamenjoyVD (N21 Community)** — Line of Sponsorship tracking, event scheduling, trip logistics, howtos, and team coordination.

**Communication style:** Direct, peer-to-peer. No fluff, no unsolicited refactors.

### Core Rules
- **Zero-Refactor Rule:** Change ONLY lines required to satisfy the DoD. Never re-indent, reformat, rename, or modernize untouched sections — even if style looks inconsistent.
- **Airtable-First Workflow:** ALWAYS query Airtable Issues before starting. Check "In Progress" first, then highest-priority unblocked "To Do".
- **Commit discipline:** One commit per issue. Always include commit URL before closing Airtable record.
- **No middleware.ts:** Use `proxy.ts`. If asked to create middleware.ts — refuse.
- **No Clerk bypass:** Never skip auth on protected routes.

### PIU Command
When the user types **PIU** ("Pack It Up"), execute this sequence:
1. Update CLAUDE.md with current session state (new stable commit, pending issues, gotchas).
2. Verify `git status` is clean and latest commit is pushed.
3. Confirm new session can start with just: repo URL + PAT + "start work".

---

## 2. Airtable Project Management

- **Base ID:** `app1n7KYX8i8xSiB7` (tevd-portal)
- **Issues Table:** `tblUq45Wo3xngSf3w`

### Field IDs
| Field | ID |
|---|---|
| Issue ID | `fldE1F4ViLRQml5Hw` |
| Name | `fldOSw4VEE9mXDpTm` |
| Type | `fldQN5hAQoMFdXxyl` |
| Status | `fldsTwNbtnh6SUuF0` |
| Priority | `flde5GkbsiEi4jtwq` |
| Blocked By | `fldRq9a57bHubveIx` |
| Target Files | `fld2hLIPYvrhcyiMA` |
| Definition of Done | `fld5U92AZuxpLHsuJ` |
| Claude Notes | `fldYsznuq4tUt79o4` |
| Commit Link | `fld0VWrOimUTolMIe` |

### Status choice IDs
| Status | Choice ID |
|---|---|
| To Do | `selO8Bg7VWY6E9sxB` |
| In Progress | `sel4MPU6wsEW7uclv` |
| Done | `selRTL4WT8qro1TnL` |
| Not relevant | `sellrX5il5BmfBxm9` |

### Workflow Loop
1. Check `Status = "In Progress"` → resume if found
2. Else: highest priority, unblocked `Status = "To Do"`
3. Claim: Status → "In Progress" (use `typecast: true`)
4. Read CLAUDE.md. Hard stop if missing/contradictory.
5. Read Target Files + DoD. Question ambiguity before coding.
6. Execute. Zero-Refactor.
7. `npx tsc --noEmit` — zero errors required before commit.
8. Commit + push. Wait for URL.
9. Status → "Done". Write Commit Link + Claude Notes in Airtable.

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.1.6 App Router + React 19 | Turbopack enabled |
| Auth | Clerk | Custom JWT template `supabase` with `user_id` + `user_role`. `UserButton` replaced by custom `UserDropdown`. |
| Database | Supabase (PostgreSQL 17) | RLS on all tables. LTree (ltree extension), pg_cron, pg_net. |
| State | TanStack Query v5 | `QueryClientProvider` in `app/providers.tsx`. |
| Styling | Tailwind CSS v4 | **No `@layer components` with `@apply`** — inline all utilities. |
| Fonts | Cormorant Garamond + DM Sans | `font-display` = Cormorant Garamond, `font-body` = DM Sans. Both via CSS vars `--font-cormorant` and `--font-dm-sans`. |
| Maps | Mapbox GL JS v2.15.0 | **CDN only** — never import as npm (SSR breaks). Token: `NEXT_PUBLIC_MAPBOX_TOKEN` (public `pk.` prefix). Fallback static tile if token missing. |
| iCal | jose + ical-generator | `/api/calendar/feed.ics?token=<jwt>`. Secret: `ICAL_TOKEN_SECRET`. |
| Middleware | `proxy.ts` | NEVER create `middleware.ts`. |
| Deployment | Vercel | Team: `teamenjoyvd`. Project ID: `prj_HFZJZg2vkLtpX8XvjJlo3mDkSCyn`. |

### Infrastructure IDs
- **Supabase project:** `ynykjpnetfwqzdnsgkkg` (eu-west-1)
- **Repo:** `https://github.com/teamenjoyvd/tevd-portal.git` (private, `main` branch only)
- **Production:** `https://tevd-portal.vercel.app`

---

## 4. Environment Variables (Vercel)

| Var | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | ✅ Set |
| `CLERK_SECRET_KEY` | Clerk | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service | ✅ Set |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox (public pk.) | ✅ Set |
| `ICAL_TOKEN_SECRET` | iCal JWT signing | ✅ Set (openssl rand -hex 32) |
| `NEXT_PUBLIC_APP_URL` | Base URL for iCal + slug copy links | `https://tevd-portal.vercel.app` |
| `INSTAGRAM_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending (ISS-0038 done, tokens needed) |
| `FB_PAGE_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending |
| `FB_PAGE_ID` | Meta Graph API | ⏳ Pending |

---

## 5. Design System — 2026 Bento

All tokens defined in `styles/brand-tokens.css`.

### Brand Palette
| Token | Value | Usage |
|---|---|---|
| `--brand-forest` | `#2d332a` | Dark green — hero, nav, map tile bg, footer bg |
| `--brand-crimson` | `#bc4749` | Red — CTAs, Eyebrow labels, notification dots |
| `--brand-teal` | `#3E7785` | Blue-green — links tile, teal variant, sign-in button |
| `--brand-parchment` | `#FAF8F3` | Warm cream — page bg |
| `--brand-void` | `#1A1F18` | Near-black — primary text |
| `--brand-oyster` | `#F0EDE6` | Light warm — card surfaces |
| `--brand-stone` | `#8A8577` | Mid-grey — secondary text, timestamps |

### Semantic Tokens
| Token | Value |
|---|---|
| `--bg-global` | `var(--brand-parchment)` (#FAF8F3) |
| `--bg-global-rgb` | `250, 248, 243` (for rgba() use in frosted navbar) |
| `--bg-card` | `var(--brand-oyster)` (#F0EDE6) |
| `--text-primary` | `var(--brand-void)` (#1A1F18) |
| `--text-secondary` | `var(--brand-stone)` (#8A8577) |
| `--border-default` | `rgba(45, 51, 42, 0.08)` |
| `--border-hover` | `rgba(188, 71, 73, 0.30)` (crimson tint on hover) |

### BentoCard Variants
| Variant | Class | Use |
|---|---|---|
| `default` | `.card` | Standard card — oyster bg, border-default |
| `forest` | `.card.card--forest` | Dark green — hero, map, forest accent tiles |
| `crimson` | `.card.card--crimson` | Red — trips tile |
| `teal` | `.card.card--teal` | Teal — quick links tile |
| `edge-info` | `.card.card--edge-info` | Left-edge accent (teal border-l-4). Adds `.card--edge-full` to restore all-corners radius when used as standalone bento tile. |
| `edge-alert` | `.card.card--edge-alert` | Left-edge accent (crimson border-l-4) |

### Eyebrow Component
- Default color: `var(--brand-crimson)`
- Accepts optional `style` prop to override color (e.g. parchment on teal/forest tiles)
- Tracking: `0.25em`, Weight: `font-semibold`

### BentoGrid
- `grid-template-columns: repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Outer wrapper: `max-w-[1440px] mx-auto px-8 xl:px-12 2xl:px-16`
- Mobile: collapses to `grid-template-columns: 1fr`
- **Client tile gotcha:** Tile components MUST accept `rowSpan` prop and apply it — otherwise the CSS grid collapses.

### Bento Enter Animation
Pure CSS in `app/globals.css` — `@keyframes bento-enter` + `.bento-tile` class.

---

## 6. Homepage Layout (post v1.3.0)

12-col, 4-row bento grid. All rows are `rowSpan={2}`.

```
ROW 1: Hero(col-6,forest) | Profile(col-2,default) | Events(col-4,default)*
ROW 2: Trips(col-3,crimson)* | Announcements(col-6,default)* | Links(col-3,teal)*
ROW 3: Socials(col-4,default) | Theme(col-2,default) | Map(col-3,forest) | About Us(col-3,default)
ROW 4: Howtos(col-12,default)
```

**\* = tiles marked with asterisk are conditionally rendered — they return null when data is empty for the current role. The grid auto-fills.**

Notes:
- Announcements: `variant="default"` (NOT edge-info — confirmed by owner, 2026-03-18)
- Trips tile: shows `image_url` as 22% opacity overlay when set
- Socials tile: placeholder until Meta tokens set in Vercel env

---

## 7. Navigation

### Header (components/layout/Header.tsx)
- Public routes (no auth redirect): `/`, `/about`, `/calendar`, `/trips`
- Authenticated-only routes: `/profile`, `/notifications`, `/los`, `/howtos`, `/admin`
- Nav links: Home, About, Calendar, Trips, Guides (/howtos), My Network (/los — non-guests only)
- **i18n gotcha:** When `lang === 'bg'`, nav uses `tracking-normal` (no uppercase). When `lang === 'en'`, uses `tracking-widest uppercase`. Cyrillic all-caps is illegible.
- Sign-in button: `var(--brand-teal)` background, white text

### Footer (components/layout/Footer.tsx)
- `'use client'` — uses `useLanguage` for translated nav links
- Forest bg, parchment text, 3-col layout (brand | nav | socials+email)
- `max-w-[1440px]`, ~100px desktop height
- Nav links also respect BG casing rule

---

## 8. Directory Structure

```
/app
  /layout.tsx                    # Root layout, QueryClientProvider, fonts
  /providers.tsx                 # TanStack Query + Clerk
  /globals.css                   # bento-enter keyframes, .bento-tile, --cal-height
  /(auth)
    /sign-in/[[...sign-in]]/page.tsx  # Branded Clerk appearance (crimson primary)
    /sign-up/[[...sign-up]]/page.tsx  # Branded Clerk appearance
  /(dashboard)
    /layout.tsx                  # pt-20 on main (frosted navbar clearance)
    /page.tsx                    # Homepage — full 12-col BentoGrid server component
    /about/page.tsx
    /announcements/page.tsx
    /calendar/page.tsx
    /howtos/page.tsx
    /howtos/[slug]/page.tsx
    /links/page.tsx
    /los/page.tsx                # Member LOS view — upline + downlines by level
    /notifications/page.tsx      # Soft-delete, per-item + bulk clear
    /profile/page.tsx
    /trips/page.tsx
  /admin
    /layout.tsx                  # forest nav bar — Approval Hub, Operations, Members, LOS Tree, Calendar, Content, Howtos, Data Center, Notifications
    /approval-hub/page.tsx
    /calendar/page.tsx           # Full CRUD for calendar_events
    /content/page.tsx            # Announcements + Links (both with edit forms) + BentoSettings
    /data-center/page.tsx
    /howtos/page.tsx             # Howtos CMS — crash-fixed, publish/draft badge, slug copy button
    /los/page.tsx
    /members/page.tsx
    /members/[id]/page.tsx
    /notifications/page.tsx      # Audit log — all notifications incl. soft-deleted
    /operations/page.tsx         # Trips + edit form + milestones + payments
  /api
    /admin
      /announcements/route.ts    # POST, GET
      /announcements/[id]/route.ts  # PATCH (full body), DELETE
      /calendar/route.ts         # GET all (admin), POST (sets created_by)
      /calendar/[id]/route.ts    # PATCH, DELETE
      /quick-links/route.ts      # POST, GET
      /quick-links/[id]/route.ts # PATCH (full body), DELETE
      /vital-signs/[profileId]/route.ts  # PATCH upsert
      ... (other admin routes)
    /calendar/route.ts           # Role-filtered, guest-accessible
    /los/route.ts                # Member LOS — upline + downlines (sponsor chain BFS)
    /los/tree/route.ts           # Admin/core full tree
    /notifications/route.ts      # GET (deleted_at IS NULL filter), DELETE (bulk soft-delete)
    /notifications/[id]/route.ts # PATCH (is_read, deleted_at)
    /socials/route.ts            # Meta Graph API, revalidate=3600, graceful null
    /trips/route.ts              # Guest-accessible GET
    ... (other routes)
/components
  /bento
    /BentoCard.tsx               # Eyebrow now accepts optional style prop
    /BentoGrid.tsx
    /tiles
      /HowtosTile.tsx
      /LocationTile.tsx
      /ProfileTile.tsx           # isUnverified state (role=guest + verRequest pending/denied)
      /SocialsTile.tsx           # Meta Graph API tile, graceful fallback
      /ThemeTile.tsx
  /calendar
    /CalendarClient.tsx          # Week/day/agenda: height=var(--cal-height), internal scroll
  /layout
    /Footer.tsx                  # 'use client', useLanguage, forest bg, 3-col
    /Header.tsx                  # lang-aware nav casing, isNonGuest guard for /los
    /UserDropdown.tsx            # isUnverified label override
/lib
  /hooks
    /useLanguage.ts              # Dispatches + listens to 'language-changed' custom event
    /useNotifications.ts         # + useDeleteNotification, useClearAllNotifications
/styles
  /brand-tokens.css
/supabase
  /migrations/supabase/migrations/
    /20260318000001_notifications_soft_delete.sql
    /20260318000002_core_los_notifications_digest.sql
    /20260318000003_calendar_event_notifications_core_fanout.sql
/types
  /supabase.ts                   # Regenerate after every migration
/proxy.ts                        # Auth proxy — public: /, /about, /calendar, /trips, /sign-in, /sign-up
```

---

## 9. Database Schema (key tables — post v1.3.0)

### notifications
`id, profile_id, is_read, type (enum), title, message, action_url, created_at, deleted_at`
- Soft-delete: `deleted_at timestamptz DEFAULT NULL`. Never hard-deleted.
- User queries filter `deleted_at IS NULL`. Admin audit log sees all.

### notification_type enum
`role_request | trip_request | trip_created | event_fetched | doc_expiry | los_digest`

### calendar_events
`id, google_event_id, title, description, start_time, end_time, category, visibility_roles, week_number, event_type, created_at, created_by`
- `created_by uuid → profiles(id)`: NULL = Google sync / legacy. Non-null = portal-created.
- Trigger `on_calendar_event_created` fires fan-down + fan-up for Core creators only.

### profiles
`id, clerk_id, first_name, last_name, display_names, role, abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, created_at`

### tree_nodes
`id, profile_id, parent_id, path (ltree), depth, created_at`
- **Sparse** — only portal users have entries. `rebuild_tree_paths` must be run after LOS import.
- `get_core_ancestors(profile_id)` — returns Core profile UUIDs above a given profile.

---

## 10. Access Control Pattern

Role hierarchy: `admin > core > member > guest`

Public (no auth): `/`, `/about`, `/calendar`, `/trips`
Auth required: all other routes

---

## 11. LOS Tree & Notifications (post v1.3.0)

### LOS Notifications
- **notify_role_request**: notifies admins + Core ancestors of requester (ISS-0044)
- **notify_trip_created**: notifies all member/core/admin (existing — Core already included)
- **notify_calendar_event_created**: Core-created events fan-down to ltree descendants + fan-up to Core ancestors (ISS-0057)
- **run_los_digest**: pg_cron daily at 06:00 UTC, trip_request + doc_expiry digest for Core members (ISS-0044)
- **get_core_ancestors(uuid)**: ltree ancestor query on tree_nodes → Core profile UUIDs

### Member LOS View (/los)
- Uses `get_los_members_with_profiles()` RPC — all members flat
- Upline: walk `sponsor_abo_number` chain to root (ltree NOT used — tree_nodes too sparse)
- Downlines: BFS from children index, grouped by relative_level
- Access: member/core/admin only, guests redirect to /

---

## 12. iCal Feed

- `GET /api/calendar/feed-token` — generate/return JWT
- `POST /api/calendar/feed-token` — regenerate (revokes old URL)
- `GET /api/calendar/feed.ics?token=<jwt>` — no Clerk session needed
- Permanent subscription URL by design

---

## 13. Calendar

### --cal-height CSS var (app/globals.css)
```css
:root { --cal-height: calc(100dvh - 244px); }  /* mobile */
@media (min-width: 768px) {
  :root { --cal-height: calc(100dvh - 196px); } /* desktop */
}
```
Accounts for: `pt-20` (80px) + `PageHeading py-8` (64px) + toolbar height.
If PageHeading or toolbar height changes, update this var.

### Event type filter
CalendarClient has `filterType` state (`null | 'in-person' | 'online' | 'hybrid'`).
Combinable with N21/Personal category filter. Client-side, no re-fetch.

---

## 14. Admin

### Content Page (admin/content)
- Announcements: create + toggle + delete + **edit** (inline form, all langs)
- Quick Links: create + delete + **edit** (inline form)
- Bento Settings: tile max_items config

### Operations Page (admin/operations)
- Trips: create + delete + **edit** (full form with milestones + visibility)
- Payments: log payments against approved registrations

### Calendar Page (admin/calendar)
- Full CRUD — title, description, start/end, category, event_type, visibility_roles
- week_number auto-computed from start_time if omitted
- Google-synced events visible and editable (no double-fire risk — sync deduplicates on google_event_id)

### Howtos CMS (admin/howtos)
- Block editor: heading / paragraph / callout blocks, EN+BG+SK
- Published/Draft: state badge (green/grey) + separate action button (Publish/Unpublish)
- Slug field: auto-generates from EN title, manual override, **Copy URL button** (copies full `/howtos/{slug}` URL)
- Edit crash fixed: body/access_roles normalised to arrays on load

### LOS Tree (admin/los)
- Vital sign checkboxes: disabled for members without portal profile_id (profile_id=null → no-op, now guarded)

### Notifications Audit Log (admin/notifications)
- All notifications ever fired, including soft-deleted
- Paginated 50/page, read-only

---

## 15. Key Gotchas & Decisions (updated 2026-03-18)

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| `cookies()` | Must be `await`ed in Next.js 16 |
| Tailwind v4 | No `@layer components` + `@apply`. Inline utilities only. |
| Mapbox GL JS | CDN only. Dupe guard on script load. Logo/attrib hidden via globals.css. |
| Client tiles + rowSpan | Must apply `gridRow: span N` to outermost element or grid collapses. |
| Nav i18n casing | EN: `uppercase tracking-widest`. BG: `tracking-normal` (no uppercase). Cyrillic all-caps = illegible. |
| Eyebrow on teal/forest | Pass `style={{ color: 'var(--brand-parchment)' }}` to override default crimson. |
| Soft-delete notifications | `deleted_at IS NULL` filter on all user-facing queries. Admin sees all. |
| tree_nodes sparsity | Only portal users have entries. `rebuild_tree_paths` must run after LOS import. All ltree-based features self-heal on first real import. |
| Clerk appearance | CSS vars NOT available in Clerk shadow DOM. Use hardcoded hex (#bc4749 for crimson). |
| useLanguage | Dispatches `window.dispatchEvent(new Event('language-changed'))` on toggle. All mounted instances subscribe and re-render. |
| Homepage empty tiles | Events/Trips/Announcements/Links render null when empty — no placeholder text. Grid auto-fills. |
| Announcements tile | `variant="default"` (NOT edge-info). Owner confirmed 2026-03-18. |
| `types/supabase.ts` | Regenerate after EVERY migration using Supabase MCP `generate_typescript_types`. |
| `.env.example` | Force-commit with `git add -f .env.example`. |
| `<img>` vs `next/image` | Use `<img>` for user-uploaded images (trip image_url, Meta CDN thumbnails) — domains unpredictable. |
| timeAgo() | Duplicated in notifications/page.tsx, SocialsTile.tsx. Acceptable until 4th duplicate. |

---

## 16. Releases

| Version | Date | Status | Notes |
|---|---|---|---|
| v1.0.0 | 2026-03-01 | Shipped | Core Auth & LOS |
| v1.2.0 | 2026-03-16 | Shipped | Calendar rewrite, approval hub, member profiles |
| v1.3.0 | 2026-03-18 | **Shipped** | Admin CRUD, QA fixes, LOS views, Core notifications, bento polish |

Git tag: `v1.3.0 → a6eff42`

---

## 17. Pending Issues (backlog as of 2026-03-18)

| ID | Name | Priority | Notes |
|---|---|---|---|
| ISS-0056 | Meta token expiry alert + refresh flow | Low | Follow-up from ISS-0038. Needs FB_APP_ID + FB_APP_SECRET. |

All other tickets are Done or Not relevant. Queue is clear.

---

## 18. Supabase MCP Workflow

1. Read existing function/table first with `execute_sql`
2. DDL changes → `apply_migration` (never raw `execute_sql` for DDL)
3. Verify with `execute_sql` after
4. Save SQL file to `supabase/migrations/supabase/migrations/YYYYMMDDNNNNNN_name.sql`
5. Run `generate_typescript_types` → write output to `types/supabase.ts`
6. `npx tsc --noEmit` → zero errors → commit

### RLS Pattern
```sql
(auth.jwt() ->> 'user_role') IN ('admin', 'core')
profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
```
