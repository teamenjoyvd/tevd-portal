# CLAUDE.md — teamenjoyVD Portal
> Last updated: 2026-03-18 — Session 4 handover. Current stable: ISS-0055.

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
| `NEXT_PUBLIC_APP_URL` | Base URL for iCal links | Should be `https://tevd-portal.vercel.app` |
| `INSTAGRAM_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending (ISS-0038) |
| `FB_PAGE_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending (ISS-0038) |
| `FB_PAGE_ID` | Meta Graph API | ⏳ Pending (ISS-0038) |

---

## 5. Design System — 2026 Bento

All tokens defined in `styles/brand-tokens.css`.

### Brand Palette
| Token | Value | Usage |
|---|---|---|
| `--brand-forest` | `#2d332a` | Dark green — hero, nav, map tile bg |
| `--brand-crimson` | `#bc4749` | Red — CTAs, Eyebrow labels, notification dots |
| `--brand-teal` | `#3E7785` | Blue-green — links tile, teal variant |
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

### BentoGrid
- `grid-template-columns: repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Outer wrapper: `max-w-[1440px] mx-auto px-8 xl:px-12 2xl:px-16`
- Mobile: collapses to `grid-template-columns: 1fr`
- `colSpan` and `rowSpan` props set `gridColumn: span N` and `gridRow: span N` inline styles on BentoCard
- **Client tile gotcha:** Tile components (ProfileTile, HowtosTile, ThemeTile, LocationTile) manage their own outer grid element. They MUST accept `rowSpan` prop and apply it — otherwise the CSS grid collapses. Always pass both `colSpan` AND `rowSpan` from the homepage.

### Eyebrow Component
- Color: `var(--brand-crimson)`
- Tracking: `0.25em`
- Weight: `font-semibold`

### Bento Enter Animation
Pure CSS in `app/globals.css` — `@keyframes bento-enter` + `.bento-tile` class. Add `style={{ animationDelay: 'Xms' }}` inline on each tile. Works in Server Components.

---

## 6. Homepage Layout (ISS-0034 / ISS-0052)

12-col, 4-row bento grid. All rows are `rowSpan={2}`.

```
ROW 1: Hero(col-6,forest) | Profile(col-2,default) | Events(col-4,default)
ROW 2: Trips(col-3,crimson) | Announcements(col-6,edge-info+edge-full) | Links(col-3,teal)
ROW 3: Socials(col-4,default,placeholder) | Theme(col-2,default) | Map(col-3,forest) | About Us(col-3,default)
ROW 4: Howtos(col-12,default)
```

Client tiles: `ProfileTile`, `ThemeTile`, `LocationTile`, `HowtosTile` — all in `components/bento/tiles/`.

Socials tile is a placeholder until ISS-0038 (Meta API tokens pending from owner).

---

## 7. Directory Structure

```
/app
  /layout.tsx                    # Root layout, QueryClientProvider, fonts
  /providers.tsx                 # TanStack Query + Clerk
  /globals.css                   # bento-enter keyframes, .bento-tile
  /(auth)
    /sign-in/[[...sign-in]]/page.tsx
    /sign-up/[[...sign-up]]/page.tsx
  /(dashboard)
    /layout.tsx                  # pt-20 on main (frosted navbar clearance)
    /page.tsx                    # Homepage — full 12-col BentoGrid server component
    /about/page.tsx              # Square image col-4 + intro col-8 + contact col-12
    /announcements/page.tsx      # BentoGrid, col-12 edge-info cards
    /calendar/page.tsx           # Server component, CalendarClient child
    /howtos/page.tsx             # List: col-6 link cards
    /howtos/[slug]/page.tsx      # Article: server component, role gate → redirect /
    /links/page.tsx              # col-6 anchor-wrapped BentoCards
    /notifications/page.tsx      # List structure, brand token TYPE_STYLES
    /profile/page.tsx            # BentoGrid: Identity col-6, TravelDoc col-6,
                                 # ABO col-12 edge-info (guests), CalSub col-12,
                                 # LOSSubtree col-12, Save col-12
    /trips/page.tsx              # TripCards in BentoGrid col-6 divs
  /admin
    /layout.tsx                  # max-w-[1440px], forest nav bar, LOS Tree link
    /page.tsx                    # Redirect → /admin/approval-hub
    /approval-hub/page.tsx
    /content/page.tsx            # Announcements + Links + BentoSettings
    /data-center/page.tsx        # CSV import + diff view
    /howtos/page.tsx             # Howtos CMS with block editor
    /los/page.tsx                # LOS tree with vital signs checkboxes (ISS-0054)
    /members/page.tsx
    /members/[id]/page.tsx
    /operations/page.tsx         # Trips + milestones + payments
  /api
    /admin
      /announcements/route.ts
      /announcements/[id]/route.ts
      /bento-config/route.ts     # GET + PATCH (admin only)
      /howtos/route.ts
      /howtos/[id]/route.ts
      /quick-links/route.ts
      /quick-links/[id]/route.ts
      /registrations/[id]/route.ts
      /vital-signs/[profileId]/route.ts  # PATCH upsert ticket status
    /calendar
      /route.ts                  # role-filtered events
      /feed-token/route.ts       # GET (generate) + POST (regenerate) iCal JWT
      /feed.ics/route.ts         # Public iCal feed (token auth only, no Clerk)
    /events/[id]
      /request-role/route.ts
    /howtos
      /route.ts                  # Public list, role-filtered
      /[slug]/route.ts           # Public single, role gate → 403
    /los
      /tree/route.ts             # GET full tree + vital signs (admin/core only)
    /notifications/route.ts
    /profile
      /route.ts
      /upline/route.ts
      /verify-abo/route.ts
    /trips
      /route.ts                  # GET role-filtered, POST (admin)
      /[id]/route.ts
      /[id]/payments/route.ts
      /[id]/register/route.ts
      /[id]/registrations/route.ts
    /home/route.ts               # Legacy — not actively used by homepage anymore
/components
  /bento
    /BentoCard.tsx               # Variants: default/forest/crimson/teal/edge-info/edge-alert
    /BentoGrid.tsx               # 12-col grid wrapper
    /tiles
      /HowtosTile.tsx            # 'use client', useTileMaxItems('howtos',4)
      /LocationTile.tsx          # 'use client', Mapbox CDN, fallback if no token
      /ProfileTile.tsx           # 'use client', 4 states: loading/guest/unverified/member+
      /ThemeTile.tsx             # 'use client', SSR-safe localStorage toggle
  /calendar
    /CalendarClient.tsx          # Month/Week/Day views. startOfWeek=Monday ✅
  /events
    /EventPopup.tsx              # 3-pill roles: HOST/SPEAKER/PRODUCT
  /layout
    /Footer.tsx
    /Header.tsx                  # Frosted fixed navbar, NotificationPopup, UserDropdown
    /NotificationPopup.tsx       # Bell dropdown, last 5, mark-read, View all
    /PageContainer.tsx
    /PageHeading.tsx             # bg: --bg-global, font-display, crimson accent word
    /UserDropdown.tsx            # Initials, role badge, upline, lang toggle, sign out
  /notifications
    /NotificationPopup.tsx
  /trips
    /RegisterButton.tsx
/lib
  /hooks
    /useBentoConfig.ts           # useBentoConfig() + useTileMaxItems(key, fallback)
    /useLanguage.ts              # { lang, toggle, t(key) }
    /useNotifications.ts
  /i18n
    /translations.ts             # 90+ EN/BG keys, DAYS_I18N, MONTHS_I18N
  /supabase
    /service.ts                  # createServiceClient() — service role, bypasses RLS
/styles
  /brand-tokens.css              # All CSS custom properties + .card variants + .bento-grid
/supabase
  /migrations/supabase/migrations/
    /20260317000001_fix_trip_notification_url.sql
    /20260317000002_import_los_members_typed_return.sql
    /20260317000003_create_howtos_table.sql
    /20260317000004_create_bento_config_table.sql
    /20260317000005_add_ical_token_to_profiles.sql
    /20260317000006_add_access_and_detail_fields_to_trips.sql
    /20260317000007_create_member_vital_signs.sql
/types
  /supabase.ts                   # Regenerate after every migration via Supabase MCP
/proxy.ts                        # Auth proxy — NEVER replace with middleware.ts
/.env.example                    # All required env vars documented (force-committed)
```

---

## 8. Database Schema (key tables)

### profiles
`id, clerk_id, first_name, last_name, display_names jsonb, role (enum: admin/core/member/guest), abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, created_at`

### calendar_events
`id, title, description, start_time, end_time, week_number, category (N21/Personal), event_type (in-person/online/hybrid), google_event_id, visibility_roles user_role[], created_at`

### trips
`id, title, destination, description, image_url, start_date, end_date, currency, total_cost, milestones jsonb, visibility_roles text[], location, accommodation_type, inclusions text[], trip_type, created_at`

### announcements
`id, titles jsonb, contents jsonb, is_active, access_level user_role[], created_at`

### quick_links
`id, label, url, icon_name, sort_order, access_level user_role[], created_at`

### howtos
`id, slug, title jsonb, emoji, cover_image_url, body jsonb (blocks array), access_roles text[], is_published, created_at, updated_at`

### bento_config
`tile_key (PK), max_items int, updated_at`
Seeded: events=3, trips=3, announcements=3, howtos=4, links=4

### member_vital_signs
`id, profile_id (fk profiles), event_key text, event_label text, has_ticket boolean, updated_by (clerk_id), updated_at`
UNIQUE (profile_id, event_key). RLS: members read own, admin/core full access.

### los_members
`abo_number (PK), sponsor_abo_number, name, abo_level, depth, gpv, ppv, bonus_percent, group_size, ...` (LTree path via tree_nodes table)

---

## 9. Access Control Pattern

All content tables have a visibility/access array column. Queries use `.contains('access_level', [role])` or `.contains('visibility_roles', [role])`.

Role hierarchy (enum): `admin > core > member > guest`

Pattern for resolving role in API routes:
```ts
let role = 'guest'
try {
  const { userId } = await auth()
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('clerk_id', userId).single()
    if (profile?.role) role = profile.role
  }
} catch { /* unauthenticated — treat as guest */ }
```

Server components (homepage) resolve role once then run all queries in `Promise.all`.

---

## 10. LOS Tree & Vital Signs (ISS-0054)

- **Admin:** `/admin/los` — recursive expand/collapse tree, vital sign checkboxes per node
- **Member:** `/profile` — LOSSubtree component (read-only, shows own node + downlines)
- **Events:** Hardcoded in `DEMO_EVENTS` array in `app/admin/los/page.tsx`. To add a new event, add an entry to that array — no DB change needed, events auto-provision on first checkbox click via upsert.
- **API:** `GET /api/los/tree` (admin/core), `PATCH /api/admin/vital-signs/[profileId]`
- Tree built client-side from flat list using `sponsor_abo_number` relationships.

---

## 11. iCal Feed (ISS-0047)

- `GET /api/calendar/feed-token` — requires Clerk session, generates/returns HS256 JWT stored in `profiles.ical_token`
- `POST /api/calendar/feed-token` — regenerates token (revokes old URL)
- `GET /api/calendar/feed.ics?token=<jwt>` — no Clerk session needed. Verifies JWT, cross-checks stored token (revocation), returns iCal filtered by role. Timezone: Europe/Sofia.
- Token has no expiry — permanent subscription URL by design.
- `ICAL_TOKEN_SECRET` must be set in Vercel. Generate: `openssl rand -hex 32`

---

## 12. Key Gotchas & Decisions

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| `cookies()` | Must be `await`ed in Next.js 16 |
| `<Image fill>` | Parent needs explicit `height: Npx` (not minHeight). Use `aspect-ratio` for square tiles. |
| Tailwind v4 | No `@layer components` + `@apply`. Inline utilities only. |
| Server Component events | No `onClick`, `onMouseOver` etc — causes prerender failure. |
| Supabase RPC jsonb returns | Type is `unknown`. Cast explicitly. Never spread `unknown`. |
| Mapbox GL JS | CDN only. Never npm install. Load via dynamic `<script>` with dupe guard on `document.querySelector('script[src*="mapbox-gl"]')`. CSS link before script. |
| Client tiles + rowSpan | `ProfileTile`, `HowtosTile`, `ThemeTile`, `LocationTile` all need `rowSpan` prop AND must apply `gridRow: span N` to their outermost element. Without it the bento grid collapses. |
| ThemeTile click | BentoCard has no `onClick` prop. Wrap in a `<div onClick>` instead. |
| edge-info border-radius | Default has flat left side. Add class `card--edge-full` to restore all corners when used as a standalone bento tile (not in a list). |
| Server Component i18n | `useLanguage()` is client-only. Server components (howtos article page) default to EN. Future fix: read lang from cookie. |
| Admin LOS events | `DEMO_EVENTS` in `app/admin/los/page.tsx` is the source of truth for event definitions. Adding an event there auto-provisions it on first toggle. |
| types/supabase.ts | Regenerate after EVERY migration using Supabase MCP `generate_typescript_types`. Write output to file immediately. Run `npx tsc --noEmit` before committing. |
| `.env.example` | Gitignored by `.env*` glob. Force-commit with `git add -f .env.example`. |

---

## 13. Pending Issues (backlog as of 2026-03-18)

| ID | Name | Priority | Notes |
|---|---|---|---|
| ISS-0032 | Footer design | Medium | **Blocked on owner decision**: A (bento tile) or B (full-width with tokens) |
| ISS-0038 | Socials bento tile | Medium | **Blocked on tokens**: needs `INSTAGRAM_ACCESS_TOKEN`, `FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID` from owner |
| ISS-0042 | Unverified Member UX in UserDropdown | Low | No DB change. role=guest + verify request pending/denied |
| ISS-0043 | Notifications: soft-delete + audit log | Medium | `deleted_at` column, per-item + bulk delete, admin audit |
| ISS-0044 | Core LOS notifications digest | Medium | pg_cron daily digest. Immediate for trip_created/role_request |
| ISS-0045 | Member LOS view (/los page) | Medium | ltree: self + upline chain + all downlines |
| ISS-0029-1 | Delete legacy BentoGrid component | Low | `components/home/BentoGrid.tsx` — already deleted. Mark Done. |

---

## 14. Supabase MCP Workflow

1. Read existing function/table first with `execute_sql`
2. DDL changes → `apply_migration` (never raw `execute_sql` for DDL)
3. Verify with `execute_sql` after
4. Save SQL file to `supabase/migrations/supabase/migrations/YYYYMMDDNNNNNN_name.sql`
5. Run `generate_typescript_types` → write output to `types/supabase.ts`
6. `npx tsc --noEmit` → zero errors → commit

### RLS Pattern
```sql
-- Role check via JWT claim (set by Clerk custom template)
(auth.jwt() ->> 'user_role') IN ('admin', 'core')
-- Own-row check
profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
```
