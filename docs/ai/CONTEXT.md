# CONTEXT.md — teamenjoyVD Portal Reference
> Last updated: 2026-03-23 — v2.0.0. Latest stable commit: fe1e5d0.
> **Read on demand in GATHER only. Never read at SSU.**
> Consult the section map in CLAUDE.md §9 to read only what the ticket needs.

---

## 1. Directory Structure

```
/app
  /(dashboard)
    /page.tsx                    # Homepage — 12-col BentoGrid server component
    /about/page.tsx              # CANONICAL dual-layout reference
    /trips/page.tsx
    /trips/[id]/page.tsx         # Trip detail — auth-gated, registered users only
    /profile/page.tsx            # Multi-bento layout, drag/drop reorder + collapsible; payment submit via Drawer
  /admin
    /approval-hub/page.tsx       # ABO + manual verification review
    /calendar/page.tsx           # Events ordered ascending by start_time; create/edit via Drawer
    /content/page.tsx            # Announcements, Quick Links, Guides, Social Posts, Bento config; edit forms via Drawer
    /data-center/page.tsx        # LOS import + reconciliation panel
    /notifications/page.tsx      # All-time audit log incl. soft-deleted, paginated 50/page
    /operations/page.tsx         # 3 URL-param tabs: ?tab=trips|items|payments. All create/edit via Drawer.
    /payable-items/page.tsx      # Redirect → /admin/operations?tab=items (ISS-0186)
  /api
    /admin/calendar/route.ts
    /admin/payments/route.ts               # GET all payments (profiles!profile_id FK hint required) + POST log payment (admin)
    /admin/payments/[id]/route.ts          # PATCH admin_status + admin_note
    /admin/payable-items/route.ts
    /admin/payable-items/[id]/route.ts
    /admin/verify/route.ts
    /admin/vital-sign-definitions/route.ts
    /admin/vital-sign-definitions/[id]/route.ts
    /admin/members/route.ts                # GET LOS members + profiles + pending verifications + guests
    /admin/members/[id]/route.ts           # GET member profile + payments (unified) + registrations
    /admin/members/[id]/vital-signs/route.ts
    /admin/members/[id]/vital-signs/[definitionId]/route.ts
    /admin/social-posts/route.ts
    /admin/social-posts/[id]/route.ts
    /admin/social-posts/preview/route.ts   # GET ?url=... — OG scrape
    /admin/trips/registrations/[id]/cancel/route.ts
    /payable-items/route.ts                # member-facing active items
    /payments/route.ts                     # member-facing GET+POST (unified payments table)
    /profile/payments/route.ts             # GET trip registrations+payments; POST member payment
    /profile/route.ts
    /profile/verify-abo/route.ts
    /profile/vitals/route.ts
    /profile/event-roles/route.ts
    /profile/los-summary/route.ts
    /profile/upline/route.ts
    /profile/trips/[id]/cancel/route.ts
    /trips/[id]/payments/route.ts          # GET payments by trip_id (unified payments table)
    /socials/route.ts
    /webhooks/clerk/route.ts
/components
  /about/AboutMapTile.tsx
  /bento/BentoCard.tsx
  /bento/BentoGrid.tsx
  /bento/tiles/LocationTile.tsx
  /events/EventPopup.tsx
  /layout/Footer.tsx
  /layout/Header.tsx
  /layout/BottomNav.tsx          # DEAD STUB — do not import
  /ui/Drawer.tsx                 # Right slide-over Drawer — use for ALL admin create/edit forms
/lib
  /format.ts                     # EET helpers — always use this
  /nav.ts                        # Single source of truth for all nav configs (payable-items entry removed)
  /role-colors.ts                # getRoleColors(role) — always use this
  /og-scrape.ts                  # Server-only OG scraper (nulls for IG/FB — platforms block server fetches)
  /supabase/client.ts            # Browser client (anon key)
  /supabase/server.ts            # Server client (anon key + cookies)
  /supabase/service.ts           # Singleton service role client — do not create new client per request
  /i18n/translations.ts          # Translation source of truth — add keys here before using t()
/styles/brand-tokens.css
/.github/workflows/check-types.yml
/docs/ai/CONTEXT.md
/supabase/migrations/
/types/supabase.ts
```

### /profile bento inventory (member/core/admin)

All bentos are drag/drop reorderable and collapsible. Order + collapsed state persisted to `profiles.ui_prefs` via debounced PATCH. Personal Details is pinned at index 0 (not draggable). Collapsed state renders a compact labelled strip — NOT a blank card shell.

| Bento | ID | Col-span | Renders when |
|---|---|---|---|
| A: Personal Details | `personal` | col-8 | always (pinned) |
| B: Trips | `trips` | col-4 | hasTrips |
| C: Payments | `payments` | col-4 | always (empty state shown); + Submit payment opens Drawer |
| D: Vital Signs | `vitals` | col-4 | hasVitals |
| E: Participation | `participation` | col-4 | hasEventRoles |
| F: Calendar Subscription | `calendar` | col-8 | always |
| G: Stats | `stats` | col-8 | abo_number present |
| H: Admin Tools | `admin` | col-8 | role === 'admin' |

---

## 2. Key Files & Patterns

### `lib/nav.ts`
Single source of truth for all navigation. Header, Footer, and AdminNav all import from here. Never hardcode nav labels in components.

```ts
PUBLIC_NAV          // Home, About, Calendar, Trips
MEMBER_NAV          // Guides, My Network (/los), Profile (/profile)
FOOTER_MEMBER_NAV   // MEMBER_NAV filtered — excludes /los. Footer shows: Guides + Profile.
ADMIN_NAV           // Approval Hub, Operations, Calendar, Content, Notifications, Members
                    // Note: payable-items removed — absorbed into /operations?tab=items
```

Nav labels use inline `labels: { en, bg }` — NOT the `t()` i18n system. `sk` locale not covered in nav labels.

### `lib/format.ts`
EET/EEST regional formatting. **Always import from here — never inline `toLocaleDateString` or Intl.**
```ts
formatDate(iso)       // 18.03.2026
formatShortDate(iso)  // 18.03.
formatLongDate(iso)   // Сряда, 18.03.2026
formatTime(iso)       // 14:30
formatDateTime(iso)   // 18.03.2026, 14:30
formatCurrency(n)     // 1.234,00 €
calDay(iso)           // 18
calMonth(iso)         // MAR
```

### `lib/role-colors.ts`
**Always `getRoleColors(role)` — never hardcode role bg/font inline.**

### `lib/supabase/service.ts`
Singleton service role client. Do not create a new client per request.

### `lib/i18n/translations.ts`
`TranslationKey = keyof typeof translations` — strict union. Every new `t()` call requires a corresponding entry here or the build breaks.

### `lib/og-scrape.ts`
Server-only. Returns nulls for IG/FB URLs — platforms block server fetches. Preview endpoint at `/api/admin/social-posts/preview?url=...` wraps this and is called client-side on URL blur in the admin social posts form.

### `components/ui/Drawer.tsx`
Right slide-over Drawer primitive. Use for ALL admin create/edit forms and member-facing modal flows site-wide.
Props: `open`, `onClose`, `title`, `children`.
- Backdrop click closes. Escape key closes. Body scroll locked while open.
- Exceptions: Announcements create + Quick Links create stay as always-visible inline cards. Delete stays inline with `window.confirm`.
- Pattern for create+edit: single `drawerOpen` bool + `editing` state. `openCreate()` clears editing; `openEdit(item)` pre-fills.

### `components/about/AboutMapTile.tsx`
Client Mapbox tile. Accepts `gridColumn`, `className`, `style` props. Theme-aware (`outdoors-v12` light / `dark-v11` dark). MutationObserver on `data-theme`.

### `components/events/EventPopup.tsx`
- **Mobile (<768px):** Fixed bottom sheet — backdrop + `rounded-t-2xl`, `85dvh` max, drag handle, `overflow-y-auto` on wrapper. NOT `overflow-hidden`. Backdrop tap-to-close.
- **Desktop:** Anchor-relative popover, clamped to viewport on all sides, `maxHeight: 360` on body scroll container.
- **Guest / unauthenticated:** Roles section hidden entirely (`isGuest = userRole === 'guest' || userRole === null`).

### `components/bento/tiles/LocationTile.tsx`
Theme-aware via MutationObserver. `border: none` override on BentoCard.

### About Page (`app/(dashboard)/about/page.tsx`) — CANONICAL DUAL LAYOUT REFERENCE
Option B: `hidden md:block` desktop grid + `md:hidden` mobile stack. Read before implementing any new page with dual layouts.

---

## 3. Navigation

### Header (`components/layout/Header.tsx`)
- Public routes: `/`, `/about`, `/calendar`, `/trips`
- Auth-only: `/profile`, `/notifications`, `/los`, `/guides`, `/admin`
- Mobile hamburger: `md:hidden` button, slide-down drawer, outside-click + Escape dismissal
- Nav casing: `tracking-widest uppercase` unconditionally for all languages

### Footer (`components/layout/Footer.tsx`)
- Logo: `w-10 h-10` (40px), `filter: brightness(0) invert(1)` — white on forest bg
- Nav: `hidden md:flex flex-nowrap` — hidden on mobile, single row on md+
- Nav order: Home → About → Calendar → Trips → Guides → Profile
- 3-col: brand | nav | socials (IG, FB, email icons)
- No subheading under logo/brand name
- Bottom bar: `© 2026 teamenjoyVD · All rights reserved` | `Built with ♥ by Vera & Deniz in Sofia.`
- **NO BottomNav. NO mobile tab bar. Mobile nav = Header hamburger only.**

---

## 4. Database Schema

> Live schema is always the source of truth. Use `Supabase:list_tables verbose` to verify before touching any table.

### `profiles`
`id, clerk_id, first_name, last_name, display_names, role, abo_number, upline_abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, phone, contact_email, created_at, ui_prefs`
- `role` default: `'guest'`
- `upline_abo_number` — soft upline ref for no-ABO members
- `ui_prefs` JSONB NOT NULL default `{}` — shape: `{ bento_order: string[], bento_collapsed: Record<string, boolean> }`

### `payable_items`
`id, title, description, amount, currency, item_type, linked_trip_id, is_active, created_by, created_at, properties`
- `item_type`: `'merchandise' | 'ticket' | 'food' | 'book' | 'other'` (note: `'trip'` removed in ISS-0190)
- `properties` JSONB NOT NULL default `{}` — item-specific attributes (size, colour, engraving text, etc.)
- Admin/core CRUD. Members read active only. Soft-delete via `is_active = false`.

### `payments` (unified)
`id, profile_id, trip_id, payable_item_id, amount, currency, transaction_date, admin_status, member_status, admin_reject_reason, member_reject_reason, payment_method, proof_url, note, admin_note, logged_by_admin, properties, created_at`
- **Entity constraint:** exactly one of `trip_id` / `payable_item_id` must be non-null (`num_nonnulls(...) = 1`).
- `admin_status` / `member_status`: `'pending' | 'approved' | 'rejected'`. Both default `'pending'`.
- Green state = both `approved`.
- **Admin-logged:** `logged_by_admin = admin_profile_id`, `admin_status = 'approved'`, `member_status = 'pending'`.
- **Member-submitted:** `logged_by_admin = NULL`, `member_status = 'approved'`, `admin_status = 'pending'`.
- `properties` JSONB NOT NULL default `{}` — member-supplied variant data at purchase time.
- RLS: admin/core full access; member SELECT own; member INSERT own + `logged_by_admin IS NULL`; member UPDATE own admin-logged rows only.
- **`trip_payments` table dropped.** `payment_status` enum dropped. All old routes migrated.
- **FK ambiguity:** `payments` has two FKs to `profiles` (`profile_id` + `logged_by_admin`). Any PostgREST join MUST use `profiles!profile_id(...)` — see Gotchas.

### `trip_registrations`
`id, trip_id, profile_id, status, created_at, cancelled_at, cancelled_by`
- `status` enum: `pending | approved | denied` — no cancelled value.
- Cancelled signal: `cancelled_at IS NOT NULL`.
- Member cancel: POST `/api/profile/trips/[id]/cancel`. Admin cancel: POST `/api/admin/trips/registrations/[id]/cancel`.
- 409 if already cancelled.

### `notifications`
`id, profile_id, is_read, type (enum), title, message, action_url, created_at, deleted_at`
- Soft-delete: `deleted_at IS NULL` on user queries. Admin audit log sees all.

### `calendar_events`
`id, google_event_id, title, description, start_time, end_time, category, visibility_roles, week_number, event_type, created_at, created_by`

### `social_posts`
`id, platform, post_url, caption, thumbnail_url, is_visible, is_pinned, sort_order, created_at`
- Single pinned post enforced via partial unique index `social_posts_single_pinned (WHERE is_pinned=true)`.
- Pin swap via `pin_social_post(p_id uuid)` RPC — atomic.

### `announcements`
`id, titles, contents, access_level, is_active, sort_order, created_at`

### `vital_sign_definitions`
`id, category, label, is_active, sort_order, created_at`
- 6 categories: N21 CONNECT, N21 CONNECT+, BBS, WES, CEP, CEP+. UNIQUE on category.

### `member_vital_signs`
`id, profile_id, definition_id, recorded_at, note, created_at, recorded_by`
- UNIQUE on (profile_id, definition_id).

### `abo_verification_requests`
`id, profile_id, claimed_abo, claimed_upline_abo, request_type, status, admin_note, created_at, resolved_at`
- `request_type`: `'standard' | 'manual'`

### `tree_nodes`
`id, profile_id, parent_id, path (ltree), depth, created_at`
- No-ABO label: `p_<uuid_no_hyphens>`. Renamed to real ABO label on assignment.
- On ABO assignment: `rebuild_tree_paths` called.

---

## 5. Design System

All tokens: `styles/brand-tokens.css`. Role colors: `lib/role-colors.ts` — always `getRoleColors(role)`.

### Brand Palette
| Token | Value | Usage |
|---|---|---|
| `--brand-forest` | `#2d332a` | Hero, nav, map tile bg, footer bg |
| `--brand-crimson` | `#bc4749` | CTAs, eyebrow labels, notification dots |
| `--brand-teal` | `#3E7785` | Links tile, sign-in button |
| `--brand-parchment` | `#FAF8F3` | Warm cream — page bg |
| `--brand-void` | `#1A1F18` | Near-black — primary text |
| `--brand-oyster` | `#F0EDE6` | Light warm — card surfaces |
| `--brand-stone` | `#8A8577` | Mid-grey — secondary text, timestamps |

### Semantic Tokens
| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#1A1F18` | `#FAF8F3` |
| `--text-secondary` | `#5C5950` | `#B5B0A8` |
| `--text-tertiary` | `#8A8577` | (inherits light) |
| `--bg-global` | `#FAF8F3` | `#1A1F18` |
| `--bg-card` | `#F0EDE6` | `#252B23` |
| `--border-default` | `rgba(45, 51, 42, 0.08)` | — |
| `--border-hover` | `rgba(188, 71, 73, 0.30)` | — |

### Role Colors
| Role | bg | font |
|---|---|---|
| admin | `#DC143C` | `#faf8f3` |
| core | `#008080` | `#faf8f3` |
| member | `#1a6b4a` | `#faf8f3` |
| guest | `#e8e4dc` | `#2d2d2d` |

### BentoCard Variants
| Variant | Use |
|---|---|
| `default` | Standard card |
| `forest` | Dark green — hero, map |
| `crimson` | Red — trips tile |
| `teal` | Teal — quick links |
| `edge-info` | Left teal border |
| `edge-alert` | Left crimson border |

### BentoGrid
- `grid-template-columns: repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Outer wrapper: `max-w-[1440px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16`
- Mobile: `.bento-mobile-full` = `grid-column: 1/-1 !important`, `.bento-mobile-half` = `span 6 !important`
- Client tiles must accept + apply `rowSpan` prop or grid collapses.
- Eyebrow default: `var(--brand-crimson)`. On teal/forest tiles: pass `style={{ color: 'var(--brand-parchment)' }}`.

### Homepage Grid
```
ROW 1: Hero(col-6,forest) | Profile(col-2,default) | Events(col-4,default)*
ROW 2: Trips(col-3,crimson)* | Announcements(col-6,default)* | Links(col-3,teal)*
ROW 3: Socials(col-4,default) | Theme(col-2,default) | Map(col-3,forest) | About Us(col-3,default)
ROW 4: Guides(col-12,default)
* = conditionally rendered — return null when empty. Grid auto-fills.
```

---

## 6. Regional Standards & i18n

- Dates: `DD.MM.YYYY`. Time: 24h (`14:30`). Currency: `1.234,56 €`. Week starts Monday.
- **Always `lib/format.ts` — never inline `toLocaleDateString` or Intl.**
- Translations: `lib/i18n/translations.ts`. `TranslationKey` is strict — add before using `t()` or build fails.
- Supported locales: `en`, `bg`. Nav labels use `labels: { en, bg }` system in `lib/nav.ts` — NOT `t()`.

---

## 7. Access Control

Role hierarchy: `admin > core > member > guest`

Public (no auth): `/`, `/about`, `/calendar`, `/trips`. Auth-required: all other routes including `/trips/[id]`.

### Verification Paths

**Path A — Standard ABO:** Guest submits `claimed_abo` + `claimed_upline_abo` → admin approves → `role='member'`, `abo_number` set.

**Path B — Manual, no ABO, user-initiated:** Guest submits `claimed_upline_abo` only, `request_type='manual'` → admin approves → `role='member'`, placed as `p_<uuid>` child of upline.

**Path C — Admin-initiated manual:** Admin picks guest, provides upline ABO → directly promotes to member.

### Role promotion → Clerk metadata sync
Every route that updates `profiles.role` MUST also call:
```ts
const clerk = await clerkClient()
await clerk.users.updateUserMetadata(clerkId, { publicMetadata: { role: newRole } })
```
Routes: `/api/admin/verify`, `/api/admin/members/verify/[id]`, `/api/admin/members/[id]` PATCH.
**Pre-fix cohort:** users promoted before commit 4b2d69c have stale Clerk metadata. Re-login to fix.

### /trips registered UX
Users with `registration.status !== 'denied'` see "View Trip Details" → `/trips/[id]`. Register button only shown when no registration OR status is denied.

---

## 8. LOS Tree & Notifications

- `notify_role_request`: admins + Core ancestors of requester
- `notify_trip_created`: all member/core/admin
- `notify_calendar_event_created`: Core-created → fan-down descendants + fan-up Core ancestors
- `run_los_digest`: pg_cron daily 06:00 UTC
- `get_core_ancestors(uuid)`: ltree query on tree_nodes → Core profile UUIDs
- LOS tree response: `{ scope, nodes, caller_abo }` — extract `.nodes` before `buildTree`.
- No-ABO label: `p_<uuid_no_hyphens>`. LOS import always wins for positioning.

---

## 9. Calendar

### `--cal-height` CSS var
```css
:root { --cal-height: calc(100dvh - 244px); }
@media (min-width: 768px) { :root { --cal-height: calc(100dvh - 196px); } }
```

### Period selector order
AGENDA → DAY → WEEK → MONTH

### Event type filter
Client-side `filterType` state. Clicking active filter deactivates it. Combinable with N21/Personal.

---

## 10. Admin Pages

### Calendar (`admin/calendar`)
Events ordered ascending by `start_time` (soonest first). Create/edit via Drawer (ISS-0187 — done).

### Content (`admin/content`)
Tabbed: Announcements | Quick Links | Guides | Social Posts | Bento. Social Posts tab has OG preview on URL blur. Edit forms via Drawer (ISS-0188 — done). Announcements + Quick Links: inline create stays, edit moves to Drawer. Guides: create + edit both in Drawer; `+ New Guide` always visible.

### Operations (`admin/operations`)
3 URL-param tabs (`?tab=trips|items|payments`), default `trips`. All create/edit flows via Drawer.
- **Trips tab:** list, create/edit via Drawer, delete inline with `window.confirm`.
- **Items tab:** payable items list + create/edit via Drawer + deactivate inline. Absorbs `/admin/payable-items`.
- **Payments tab:** Log Payment Drawer with `<optgroup>` entity select (Trips / active Items); member selector from `/api/admin/members` (los_members[].profile + manual_members_no_abo, sorted by last name); status filter pills (All/Pending/Approved/Rejected); pending member submissions (logged_by_admin === null) at top with inline approve/deny.

### Payable Items (`admin/payable-items`)
Now a `redirect()` → `/admin/operations?tab=items`. Removed from `ADMIN_NAV`.

### Approval Hub (`admin/approval-hub`)
Standard ABO requests + manual requests + Path C direct-verify form.

### Data Center (`admin/data-center`)
LOS import + reconciliation panel for matching unrecognized LOS members to no-ABO profiles.

### Notifications Audit Log
All-time, including soft-deleted. Paginated 50/page.

---

## 11. Environment Variables

| Var | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | ✅ Set |
| `CLERK_SECRET_KEY` | Clerk | ✅ Set |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signature | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service (server-only) | ✅ Set |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox (`pk.` prefix, public) | ✅ Set |
| `ICAL_TOKEN_SECRET` | iCal JWT signing | ✅ Set |
| `NEXT_PUBLIC_APP_URL` | Base URL for iCal + slug links | `https://tevd-portal.vercel.app` |
| `INSTAGRAM_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending |
| `FB_PAGE_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending |
| `FB_PAGE_ID` | Meta Graph API | ⏳ Pending |

---

## 12. CI — Type Check Workflow

### What it does
On every push to `main`, `.github/workflows/check-types.yml` runs:
1. **TypeScript check** — `npx tsc --noEmit`.

Note: Supabase type drift diff step was removed (2026-03-23). The Supabase CLI is not available locally and the MCP SDK generates a different output format. Types are maintained exclusively via `Supabase:generate_typescript_types` MCP tool after every migration. No `SUPABASE_ACCESS_TOKEN` secret required.

### Fix for type errors
```
1. Run Supabase:generate_typescript_types MCP tool
2. Write output to types/supabase.ts
3. npx tsc --noEmit
4. Commit and push
```

---

## 13. Releases

| Version | Date | Notes |
|---|---|---|
| v1.8.0 | 2026-03-21 | Generic payments system (payable_items + payments + cancel + ui_prefs), /profile bento split |
| v1.9.0 | 2026-03-22 | Drag/drop reorder + collapsible bentos on /profile (dnd-kit, persisted to ui_prefs) |
| v1.9.1 | 2026-03-22 | CI fix, ISS-0178 payable items admin UI, ISS-0184 collapsed bento label strip, footer QA |
| v1.9.2 | 2026-03-22 | Drawer primitive (ISS-0185) |
| v1.9.3 | 2026-03-23 | ISS-0190: drop trip_payments, unified payments table with dual-approval (admin_status + member_status), entity check constraint, all payment routes migrated, CI tsc-only |
| v2.0.0 | 2026-03-23 | Drawer rollout complete: ISS-0186 /admin/operations rewrite (3 tabs), ISS-0187 /admin/calendar, ISS-0188 /admin/content, ISS-0189 /profile payment modal. PostgREST FK ambiguity fix on payments→profiles join. |

Latest stable commit: `fe1e5d0`

### Pending issues (next sessions)
Queue is empty. No To Do tickets remain.
