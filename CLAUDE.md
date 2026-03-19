# CLAUDE.md — teamenjoyVD Portal
> Last updated: 2026-03-19 — Session 9. Latest commit: 5cd22a7. Session 9: profile overhaul (ISS-0128–0136), footer scrollbar hotfix (ISS-0137), BottomNav removal, CLAUDE.md updated with desktop/mobile law.

---

## 0. Commands

Quick-reference for all named commands. Type the command name to execute.

| Command | What it does |
|---|---|
| **SSU** | System Status Update — checks all connections and confirms session is ready |
| **PIU** | Pack It Up — session handover, updates CLAUDE.md, verifies clean git state |

---

## SSU — System Status Update

When the user types **SSU**, execute this sequence in full, in order:

1. **Airtable** — call `list_bases`. Confirm `app1n7KYX8i8xSiB7` (tevd-portal) is reachable. Report: ✅ or ❌ + error.
2. **GitHub MCP** — call `tool_search` with query `"github get file contents"`. Confirm tools load. Then call `get_file_contents` on `CLAUDE.md` (owner: `teamenjoyvd`, repo: `tevd-portal`, branch: `main`). Report: ✅ or ❌ + error.
3. **Vercel** — call `list_teams`. Confirm `teamenjoyvd` team is reachable. Report latest production deployment state for `tevd-portal`. Report: ✅ or ❌ + error.
4. **Supabase** — call `list_projects`. Confirm `ynykjpnetfwqzdnsgkkg` (tevd-portal, eu-west-2) is `ACTIVE_HEALTHY`. Report: ✅ or ❌ + error.
5. **Instructions** — confirm `CLAUDE.md` was successfully read in step 2. Report: ✅ loaded or ❌ missing/unreadable.
6. **Queue** — check Airtable Issues for any `Status = "In Progress"` record. If found, report it. If not, report the highest-priority unblocked `Status = "To Do"` ticket.

Output a clean status table at the end:

```
## SSU Report
| Connection     | Status | Notes |
|----------------|--------|-------|
| Airtable       | ✅/❌  | ...   |
| GitHub MCP     | ✅/❌  | ...   |
| Vercel         | ✅/❌  | ...   |
| Supabase       | ✅/❌  | ...   |
| CLAUDE.md      | ✅/❌  | ...   |
| Queue          | —      | ISS-XXXX: ... / All clear |
```

If any connection is ❌, do not proceed to any task work — surface the failure and wait for instruction.

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

### ⚠️ DESKTOP / MOBILE LAYOUT LAW — READ THIS BEFORE TOUCHING ANY PAGE

**This project designs desktop and mobile as two separate, complete, perfectly functional layouts that share a database. There is NO hybrid responsive design. There are NO shared adaptive components that try to serve both viewports.**

The pattern is always:
```tsx
{/* Desktop */}
<div className="hidden md:block">
  {/* Full desktop layout here */}
</div>

{/* Mobile */}
<div className="md:hidden">
  {/* Full mobile layout here */}
</div>
```

**ABSOLUTE PROHIBITIONS — violation = immediate revert:**
- NEVER implement a `BottomNav`, tab bar, floating action button, or any mobile-specific navigation chrome without explicit written sign-off in the ticket.
- NEVER use `overflow-x-auto` on navigation elements — if content overflows, the layout is wrong, not the overflow behavior.
- NEVER create components that try to be "responsive" by hiding/showing parts of themselves via breakpoints. Desktop layout = one component. Mobile layout = a separate component or block.
- NEVER add mobile padding offsets (`pb-20`, `mb-safe`, etc.) to accommodate navigation chrome that wasn't explicitly requested.
- NEVER ship a mobile UI pattern (bottom sheet nav, swipe gesture, sticky tab bar, horizontal scroll nav) that wasn't in the ticket's DoD.

**The About page (`app/(dashboard)/about/page.tsx`) is the canonical reference** for the correct dual-layout pattern. Read it before implementing any new page.

### PIU Command
When the user types **PIU** (\"Pack It Up\"), execute this sequence:
1. Update CLAUDE.md with current session state (new stable commit, pending issues, gotchas).
2. Verify `git status` is clean and latest commit is pushed.
3. Confirm new session can start with just: repo URL + PAT + \"start work\".

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
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signature | ✅ Set (added 2026-03-19) |
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
| `--brand-stone` | `#8A8577` | Mid-grey — secondary text, timestamps. Also used as LocationTile light-mode shimmer. |

### Semantic Tokens
| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#1A1F18` (brand-void) | `#FAF8F3` (brand-parchment) |
| `--text-secondary` | `#5C5950` | `#B5B0A8` |
| `--text-tertiary` | `#8A8577` | (inherits light) |
| `--bg-global` | `#FAF8F3` | `#1A1F18` |
| `--bg-card` | `#F0EDE6` | `#252B23` (brand-moss) |
| `--border-default` | `rgba(45, 51, 42, 0.08)` | — |
| `--border-hover` | `rgba(188, 71, 73, 0.30)` | — |

### BentoCard Variants
| Variant | Class | Use |
|---|---|---|
| `default` | `.card` | Standard card — oyster bg, border-default |
| `forest` | `.card.card--forest` | Dark green — hero, map, forest accent tiles |
| `crimson` | `.card.card--crimson` | Red — trips tile |
| `teal` | `.card.card--teal` | Teal — quick links tile |
| `edge-info` | `.card.card--edge-info` | Left-edge accent (teal border-l-4) |
| `edge-alert` | `.card.card--edge-alert` | Left-edge accent (crimson border-l-4) |

### Eyebrow Component
- Default color: `var(--brand-crimson)`
- Accepts optional `style` prop to override color (e.g. parchment on teal/forest tiles)
- Tracking: `0.25em`, Weight: `font-semibold`

### BentoGrid
- `grid-template-columns: repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Outer wrapper: `max-w-[1440px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16` (px-4 on mobile — ISS-0106)
- Mobile: 12-col stays, `bento-mobile-full` = `grid-column: 1/-1 !important`, `bento-mobile-half` = `span 6 !important`
- **Client tile gotcha:** Tile components MUST accept `rowSpan` prop and apply it — otherwise the CSS grid collapses.

### Bento Mobile Classes (brand-tokens.css)
- `.bento-mobile-full` — full width on mobile (Hero, Events, Announcements)
- `.bento-mobile-half` — half width / 2-col on mobile (Profile, Theme, Trips, Links, Socials, Map, About, Howtos)
- Applied via `fullWidthMobile` / `halfWidthMobile` props on BentoCard

---

## 6. Homepage Layout (current)

12-col, 4-row bento grid. All tiles `rowSpan={2}`.

```
ROW 1: Hero(col-6,forest) | Profile(col-2,default) | Events(col-4,default)*
ROW 2: Trips(col-3,crimson)* | Announcements(col-6,default)* | Links(col-3,teal)*
ROW 3: Socials(col-4,default) | Theme(col-2,default) | Map(col-3,forest) | About Us(col-3,default)
ROW 4: Howtos(col-12,default)
```

**Events tile (ISS-0119):** Each event row = left (name + event_type pill) + right (iOS date square crimson + 24h time). No week number badge.

**\* = conditionally rendered — return null when empty. Grid auto-fills.**

---

## 7. Navigation

### Header (components/layout/Header.tsx)
- Public routes: `/`, `/about`, `/calendar`, `/trips`
- Auth-only: `/profile`, `/notifications`, `/los`, `/howtos`, `/admin`
- Mobile hamburger: `md:hidden` button, slide-down drawer, outside-click + Escape dismissal
- Nav casing: `tracking-widest uppercase` unconditionally for all languages

### Footer (components/layout/Footer.tsx)
- Logo: `filter: brightness(0) invert(1)` — white on forest bg
- Nav: `hidden md:flex flex-nowrap` — hidden on mobile (Header hamburger covers mobile nav), single row on md+
- Nav order: Home → About → Calendar → Trips → Guides → My Network
- 3-col: brand | nav | socials (IG, FB, email icons)
- **NO BottomNav. NO mobile tab bar. Mobile nav = Header hamburger only.**

---

## 8. Key Files & Patterns

### lib/format.ts (NEW — ISS-0124)
EET/EEST regional formatting helpers. **Always import from here — never inline toLocaleDateString.**
```ts
formatDate(iso)       // 18.03.2026
formatShortDate(iso)  // 18.03.
formatLongDate(iso)   // Сряда, 18.03.2026  (weekday + date, bg-BG)
formatTime(iso)       // 14:30  (24h)
formatDateTime(iso)   // 18.03.2026, 14:30
formatCurrency(n)     // 1.234,00 €
calDay(iso)           // 18  (for iOS date square)
calMonth(iso)         // MAR  (for iOS date square)
```

### components/about/AboutMapTile.tsx
Client Mapbox tile for About page. Accepts `gridColumn`, `className`, `style` props. Theme-aware (light-v11/dark-v11), `#8A8577` light shimmer, MutationObserver for theme swap.

### components/events/EventPopup.tsx
- **Mobile (`<768px`):** Fixed bottom sheet — backdrop + `rounded-t-2xl` panel, `85dvh` max, drag handle
- **Desktop:** Anchor-relative popover, clamped to viewport on all sides

### components/bento/tiles/LocationTile.tsx
- Theme-aware via MutationObserver: `light-v11` / `dark-v11`
- Light shimmer: `#8A8577`, dark shimmer: `var(--brand-forest)`
- `border: none` override on BentoCard (ISS-0121)

### About Page (app/(dashboard)/about/page.tsx) — CANONICAL DUAL LAYOUT REFERENCE
Option B dual layout — `hidden md:block` desktop grid + `md:hidden` mobile stack.
Desktop: `max-w-[960px]` pure 8-col CSS grid (no BentoGrid). No gutters.
```
Row 1+2+3: [col-2 hero rowSpan-3] [col-6 heading row1 + body rowSpan-2]
Row 2:                              [email col-1] [ig col-1] [map col-2] — fills right cols
Row 3: (hero + body continue)
Row 4: [col-8 CTA]
```
Mobile: flex-col — heading → hero → body → ig+email 2-col → map → CTA.

---

## 9. Directory Structure

```
/app
  /(dashboard)
    /page.tsx                    # Homepage — 12-col BentoGrid server component
    /about/page.tsx              # Option B dual layout (desktop grid + mobile stack) ← CANONICAL REFERENCE
    /trips/page.tsx              # 'use client', formatDate + formatCurrency from lib/format
    /profile/page.tsx            # Member profile — multi-bento layout (ISS-0128–0135)
  /admin
    /calendar/page.tsx           # ascending: true (soonest first) — ISS-0123
    /notifications/page.tsx      # formatDateTime from lib/format
    /operations/page.tsx         # Trips CRUD + payment log + member submission review (ISS-0136)
  /api/admin/calendar/route.ts   # GET: ascending: true
  /api/admin/payments/route.ts   # GET (pending submissions) + POST (admin log)
  /api/admin/payments/[id]/route.ts  # PATCH (approve/deny submission)
  /api/profile/payments/route.ts # GET + POST (member payment submissions)
  /api/profile/vitals/route.ts   # GET member_vital_signs
  /api/profile/event-roles/route.ts  # GET event_role_requests + calendar_events join
  /api/profile/los-summary/route.ts  # GET depth + direct_downline_count
  /api/profile/upline/route.ts   # GET upline_name + upline_abo_number
/components
  /about
    /AboutMapTile.tsx            # Client Mapbox, accepts gridColumn/className/style props
  /bento
    /BentoCard.tsx
    /BentoGrid.tsx               # px-4 sm:px-8 xl:px-12 2xl:px-16
    /tiles
      /LocationTile.tsx          # theme-aware, border:none, #8A8577 shimmer
  /events
    /EventPopup.tsx              # mobile bottom sheet / desktop clamped popover
  /layout
    /Footer.tsx                  # logo white filter, hidden md:flex nav, My Network
    /Header.tsx                  # hamburger mobile nav, desktop nav
    /BottomNav.tsx               # DEAD FILE — not imported anywhere, pending deletion (ISS-0138)
/lib
  /format.ts                     # EET formatting helpers (NEW — always use this)
  /i18n/translations.ts
/styles
  /brand-tokens.css              # bento-mobile-full, bento-mobile-half, 12-col on mobile
```

---

## 10. Database Schema (key tables)

### notifications
`id, profile_id, is_read, type (enum), title, message, action_url, created_at, deleted_at`
- Soft-delete: `deleted_at IS NULL` on user queries. Admin audit log sees all.

### calendar_events
`id, google_event_id, title, description, start_time, end_time, category, visibility_roles, week_number, event_type, created_at, created_by`

### profiles
`id, clerk_id, first_name, last_name, display_names, role, abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, phone, contact_email, created_at`
- `role` DB default: `'guest'` (changed 2026-03-19 — new registrations start as guest)
- `phone`, `contact_email` added ISS-0128
- Profile row created by Clerk webhook (`user.created`) → `api/webhooks/clerk/route.ts`

### trip_payments
`id, trip_id, profile_id, amount, transaction_date, status, note, proof_url, payment_method, submitted_by_member, created_at`
- `proof_url`, `payment_method`, `submitted_by_member` added ISS-0128
- Members can INSERT with `submitted_by_member=true, status='pending'` only (RLS)
- Admin/Core approve/deny via PATCH `/api/admin/payments/[id]`

### tree_nodes
`id, profile_id, parent_id, path (ltree), depth, created_at`

---

## 11. Access Control

Role hierarchy: `admin > core > member > guest`

Public (no auth): `/`, `/about`, `/calendar`, `/trips`
Auth required: all other routes

### Registration Flow (2026-03-19)
1. User registers via Clerk → `user.created` webhook fires
2. Profile row created with `role: 'guest'`
3. Guest visits `/profile` → fills in details, submits ABO + upline for verification
4. Admin approves in admin panel → role promoted to `member`

---

## 12. LOS Tree & Notifications

- **notify_role_request**: admins + Core ancestors of requester
- **notify_trip_created**: all member/core/admin
- **notify_calendar_event_created**: Core-created → fan-down descendants + fan-up Core ancestors
- **run_los_digest**: pg_cron daily 06:00 UTC
- **get_core_ancestors(uuid)**: ltree query on tree_nodes → Core profile UUIDs

---

## 13. Calendar

### --cal-height CSS var
```css
:root { --cal-height: calc(100dvh - 244px); }
@media (min-width: 768px) { :root { --cal-height: calc(100dvh - 196px); } }
```

### Period selector order
AGENDA → DAY → WEEK → MONTH

### Event type filter
Client-side `filterType` state. Clicking active filter deactivates it. Combinable with N21/Personal.

---

## 14. Admin

### Calendar (admin/calendar)
- Events ordered ascending by `start_time` (soonest first) — ISS-0123
- Full CRUD, week_number auto-computed

### Operations (admin/operations)
Trips CRUD + milestones + admin payment log + member payment submission review. formatCurrency + formatDate from lib/format.

### Notifications Audit Log
All-time, including soft-deleted. Paginated 50/page. formatDateTime from lib/format.

---

## 15. Key Gotchas & Decisions (updated 2026-03-19, Session 9)

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| `cookies()` | Must be `await`ed in Next.js 16 |
| Tailwind v4 | No `@layer components` + `@apply`. Inline utilities only. |
| Mapbox GL JS | CDN only. Dupe guard on script load. Logo/attrib hidden via globals.css. |
| Mapbox theme swap | `map.setStyle()` + listen for `styledata` event to re-set ready flag. MutationObserver on `data-theme`. |
| Client tiles + rowSpan | Must apply `gridRow: span N` to outermost element or grid collapses. |
| Nav casing | `tracking-widest uppercase` for ALL languages including BG. |
| Eyebrow on teal/forest | Pass `style={{ color: 'var(--brand-parchment)' }}` to override default crimson. |
| Soft-delete notifications | `deleted_at IS NULL` filter on all user-facing queries. Admin sees all. |
| Clerk appearance | CSS vars NOT available in Clerk shadow DOM. Use hardcoded hex (#bc4749 for crimson). |
| useLanguage | Dispatches `window.dispatchEvent(new Event('language-changed'))` on toggle. |
| Homepage empty tiles | Events/Trips/Announcements/Links render null when empty. Grid auto-fills. |
| Date/time formatting | ALWAYS use `lib/format.ts`. Never inline toLocaleDateString. EET = bg-BG locale, 24h, DD.MM.YYYY. |
| Currency formatting | `formatCurrency()` from lib/format.ts → `1.234,00 €` (de-DE Intl). |
| LocationTile border | Overridden with `style={{ border: 'none' }}` on BentoCard — forest variant still shows .card border otherwise. |
| EventPopup mobile | Bottom sheet pattern (`fixed bottom-0`, `85dvh`, backdrop). NOT anchor-relative on mobile. |
| About page layout | Option B: `hidden md:block` desktop grid + `md:hidden` mobile stack. CANONICAL REFERENCE for all new pages. |
| Admin calendar order | `ascending: true` in `/api/admin/calendar` GET. Soonest first. |
| `types/supabase.ts` | Regenerate after EVERY migration. |
| `<img>` vs `next/image` | Use `<img>` for user-uploaded images (trip image_url, Meta CDN) — domains unpredictable. |
| Admin link in ProfileTile | `role === 'admin'` only. |
| `style2` prop | NEVER USE. Always merge multiple style concerns into a single `style` object. |
| Profile page guard | Use `profile?.id` check, not `!profile` — error responses are truthy objects. |
| LOSBox array guard | Always `Array.isArray()` before passing API response to `buildSubtree`. |
| Supabase service client | Singleton in `lib/supabase/service.ts` — do not create new client per request. |
| New user role | Clerk webhook defaults to `role: 'guest'`. DB column default also `'guest'`. Never change to member without explicit admin approval. |
| BottomNav | REMOVED (ISS-0137). `components/layout/BottomNav.tsx` is a dead file pending deletion (ISS-0138). Do NOT re-add or re-import. |
| Footer nav mobile | `hidden md:flex` — nav is hidden on mobile. Header hamburger is the only mobile nav. No exceptions. |
| Mobile nav chrome | NO bottom nav bars, NO tab bars, NO floating nav buttons unless explicitly in the ticket DoD with sign-off. |
| overflow-x-auto on nav | NEVER. If nav content overflows, the layout is wrong. Fix the layout. |

---

## 16. Releases

| Version | Date | Status | Notes |
|---|---|---|---|
| v1.0.0 | 2026-03-01 | Shipped | Core Auth & LOS |
| v1.2.0 | 2026-03-16 | Shipped | Calendar rewrite, approval hub, member profiles |
| v1.3.0 | 2026-03-18 | Shipped | Admin CRUD, QA fixes, LOS views, Core notifications, bento polish |
| v1.4.0 | 2026-03-18 | Shipped | Session 7: About page, mobile overhaul, QA batch, EET formatting, lib/format.ts |
| v1.4.1 | 2026-03-19 | Shipped | Session 8: CalendarClient style2 fix, profile crash guard, webhook guest default, service client singleton, SSU command |
| v1.5.0 | 2026-03-19 | **Shipped** | Session 9: Profile overhaul (ISS-0128–0136), footer scrollbar hotfix, BottomNav removal, desktop/mobile law |

Latest stable commit: `5cd22a7`

---

## 17. Pending Issues (backlog as of 2026-03-19, post Session 9)

| ID | Name | Priority | Status | Notes |
|---|---|---|---|---|
| ISS-0056 | Meta token expiry alert + refresh flow | Low | Blocked | Needs FB_APP_ID + FB_APP_SECRET in Vercel |
| ISS-0109 | Trips inner page two-col layout | P2 | To Do | Blocked by ISS-0098 + ISS-0103 per DoD — verify those are actually done |
| ISS-0125 | Design revisit: inner pages mobile layout | P2 | Needs Design | /calendar, /trips, /howtos, /profile — design spec required before coding |
| ISS-0138 | Housekeeping: delete BottomNav.tsx + consolidate formatDate/formatEur in operations | P3 | To Do | Low urgency, clean debt |

---

## 18. Supabase MCP Workflow

1. Read existing function/table first with `execute_sql`
2. DDL changes → `apply_migration` (never raw `execute_sql` for DDL)
3. Verify with `execute_sql` after
4. Save SQL to `supabase/migrations/supabase/migrations/YYYYMMDDNNNNNN_name.sql`
5. Run `generate_typescript_types` → write to `types/supabase.ts`
6. `npx tsc --noEmit` → zero errors → commit

### RLS Pattern
```sql
(auth.jwt() ->> 'user_role') IN ('admin', 'core')
profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
```
