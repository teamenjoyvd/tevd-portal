# CONTEXT.md — teamenjoyVD Portal Reference
> Last updated: 2026-03-21 — v1.8.0. Latest stable commit: e655376.
> This file is read on demand, not on every session. CLAUDE.md is the operational core.

---

## 1. Directory Structure

```
/app
  /(dashboard)
    /page.tsx                    # Homepage — 12-col BentoGrid server component
    /about/page.tsx              # CANONICAL dual-layout reference
    /trips/page.tsx
    /trips/[id]/page.tsx         # Trip detail — auth-gated, registered users only
    /profile/page.tsx            # Multi-bento layout
  /admin
    /approval-hub/page.tsx
    /calendar/page.tsx
    /data-center/page.tsx
    /notifications/page.tsx
    /operations/page.tsx
  /api
    /admin/calendar/route.ts
    /admin/payments/route.ts               # trip_payments (legacy)
    /admin/payments/[id]/route.ts
    /admin/payments-generic/route.ts       # payments table (generic system)
    /admin/payments-generic/[id]/route.ts
    /admin/payable-items/route.ts
    /admin/payable-items/[id]/route.ts
    /admin/verify/route.ts
    /admin/vital-sign-definitions/route.ts
    /admin/vital-sign-definitions/[id]/route.ts
    /admin/members/[id]/vital-signs/route.ts
    /admin/members/[id]/vital-signs/[definitionId]/route.ts
    /admin/social-posts/route.ts
    /admin/social-posts/[id]/route.ts
    /admin/trips/registrations/[id]/cancel/route.ts
    /payable-items/route.ts                # member-facing active items
    /payments/route.ts                     # member-facing GET+POST
    /profile/payments/route.ts             # trip_payments (legacy)
    /profile/route.ts
    /profile/verify-abo/route.ts
    /profile/vitals/route.ts               # Deprecated
    /profile/vital-signs/route.ts
    /profile/event-roles/route.ts
    /profile/los-summary/route.ts
    /profile/upline/route.ts
    /profile/trips/[id]/cancel/route.ts
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
/lib
  /format.ts                     # EET helpers — always use this
  /role-colors.ts                # getRoleColors(role) — always use this
  /og-scrape.ts                  # Server-only OG scraper
  /supabase/client.ts
  /supabase/server.ts
  /supabase/service.ts           # Singleton service role client
  /i18n/translations.ts          # Translation source of truth
/styles/brand-tokens.css
/.github/workflows/check-types.yml
/docs/ai/CONTEXT.md              # This file
/supabase/migrations/
/types/supabase.ts
```

### /profile bento inventory (member/core/admin)

| Bento | Col-span | Renders when |
|---|---|---|
| A: Personal Details | col-8 | always |
| B: Trips | col-4 | hasTrips |
| C: Payments | col-4 | always (empty state shown) |
| D: Vital Signs | col-4 | hasVitals |
| E: Participation | col-4 | hasEventRoles |
| F: Calendar Subscription | col-8 | always |
| G: Stats | col-8 | abo_number present |
| H: Admin Tools | col-8 | role === 'admin' |

---

## 2. Database Schema

> Live schema is always the source of truth. Use `Supabase:list_tables verbose` to verify before touching any table.

### `profiles`
`id, clerk_id, first_name, last_name, display_names, role, abo_number, upline_abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, phone, contact_email, created_at, ui_prefs`
- `role` default: `'guest'`
- `upline_abo_number` — soft upline ref for no-ABO members
- `ui_prefs` JSONB NOT NULL default `{}` — shape: `{ profile_bento_order: string[], profile_bento_collapsed: string[] }`

### `payable_items`
`id, title, description, amount, currency, item_type, linked_trip_id, is_active, created_by, created_at`
- `item_type`: `'trip' | 'book' | 'ticket' | 'other'`
- Admin CRUD. Members read active only. Soft-delete via `is_active = false`.

### `payments`
`id, profile_id, payable_item_id, amount, transaction_date, status, payment_method, proof_url, note, admin_note, submitted_by_member, created_at`
- Generic member→admin system. `status`: `pending | approved | denied`.
- Member: POST `/api/payments`. Admin: PATCH `/api/admin/payments-generic/[id]`.
- **Not `trip_payments`** — separate table, separate API paths.

### `trip_payments` (legacy)
`id, trip_id, profile_id, amount, transaction_date, status, note, proof_url, payment_method, submitted_by_member, created_at`
- `status`: `completed | pending | failed`
- Still active. Used by `/api/profile/payments` and `/api/admin/payments`.

### `trip_registrations`
`id, trip_id, profile_id, status, created_at, cancelled_at, cancelled_by`
- `cancelled_at IS NOT NULL` = cancelled. No enum change.
- Member cancel: POST `/api/profile/trips/[id]/cancel`. Admin: POST `/api/admin/trips/registrations/[id]/cancel`. 409 if already cancelled.

### `notifications`
`id, profile_id, is_read, type, title, message, action_url, created_at, deleted_at`
- Soft-delete: `deleted_at IS NULL` on user queries.

### `calendar_events`
`id, google_event_id, title, description, start_time, end_time, category, visibility_roles, week_number, event_type, created_at, created_by`

### `social_posts`
`id, platform, post_url, caption, thumbnail_url, is_visible, is_pinned, sort_order, created_at`
- Single pinned post: partial unique index `WHERE is_pinned=true`.
- Pin swap: `pin_social_post(p_id uuid)` RPC.

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
- No-ABO label: `p_<uuid_no_hyphens>`. Renamed on ABO assignment.

---

## 3. Design System

All tokens: `styles/brand-tokens.css`. Role colors: `lib/role-colors.ts` — always `getRoleColors(role)`.

### Brand Palette
| Token | Value | Usage |
|---|---|---|
| `--brand-forest` | `#2d332a` | Hero, nav, footer bg |
| `--brand-crimson` | `#bc4749` | CTAs, eyebrows, notification dots |
| `--brand-teal` | `#3E7785` | Links tile, sign-in |
| `--brand-parchment` | `#FAF8F3` | Page bg |
| `--brand-void` | `#1A1F18` | Primary text |
| `--brand-oyster` | `#F0EDE6` | Card surfaces |
| `--brand-stone` | `#8A8577` | Secondary text, timestamps |

### Semantic Tokens
| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#1A1F18` | `#FAF8F3` |
| `--text-secondary` | `#5C5950` | `#B5B0A8` |
| `--bg-global` | `#FAF8F3` | `#1A1F18` |
| `--bg-card` | `#F0EDE6` | `#252B23` |
| `--border-default` | `rgba(45,51,42,0.08)` | — |
| `--border-hover` | `rgba(188,71,73,0.30)` | — |

### Role Colors
| Role | bg | font |
|---|---|---|
| admin | `#DC143C` | `#faf8f3` |
| core | `#008080` | `#faf8f3` |
| member | `#1a6b4a` | `#faf8f3` |
| guest | `#e8e4dc` | `#2d2d2d` |

### BentoCard Variants
`default (.card)`, `forest (.card--forest)`, `crimson (.card--crimson)`, `teal (.card--teal)`, `edge-info`, `edge-alert`

### BentoGrid
- `repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Outer: `max-w-[1440px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16`
- Client tiles must accept + apply `rowSpan` prop or grid collapses.
- Eyebrow default: `var(--brand-crimson)`. On dark tiles: pass `style={{ color: 'var(--brand-parchment)' }}`.

### Homepage Grid
```
ROW 1: Hero(col-6,forest) | Profile(col-2) | Events(col-4)*
ROW 2: Trips(col-3,crimson)* | Announcements(col-6)* | Links(col-3,teal)*
ROW 3: Socials(col-4) | Theme(col-2) | Map(col-3,forest) | About(col-3)
ROW 4: Guides(col-12)
* = renders null when empty
```

---

## 4. Regional Standards & i18n

- Dates: `DD.MM.YYYY`. Time: 24h. Currency: `1.234,56 €`. Week starts Monday.
- **Always `lib/format.ts` — never inline `toLocaleDateString` or Intl.**
- Translations: `lib/i18n/translations.ts`. `TranslationKey` is strict — add before using `t()` or build fails.
- Supported locales: `en`, `bg`. Cyrillic: no uppercase transform, reduced letter-spacing.

```ts
formatDate(iso)      // 18.03.2026
formatTime(iso)      // 14:30
formatCurrency(n)    // 1.234,00 €
calDay(iso)          // 18
calMonth(iso)        // MAR
```

---

## 5. Access Control

Role hierarchy: `admin > core > member > guest`

Public: `/`, `/about`, `/calendar`, `/trips`. Auth-required: everything else.

**Verification Paths:**
- **Path A (standard ABO):** Guest submits `claimed_abo` + `claimed_upline_abo` → admin approves → `role='member'`.
- **Path B (manual, no ABO):** Guest submits `claimed_upline_abo` + selects no-ABO → `request_type='manual'` → admin approves → `role='member'`, no abo_number, placed as `p_<uuid>` child of upline.
- **Path C (admin-initiated):** Admin picks guest + provides upline ABO → direct promotion.

**Role promotion** — every `profiles.role` update MUST call:
```ts
await clerk.users.updateUserMetadata(clerkId, { publicMetadata: { role: newRole } })
```
Routes that do this: `/api/admin/verify`, `/api/admin/members/[id]` PATCH.

---

## 6. Key Component Notes

**EventPopup** — Mobile: fixed bottom sheet, `85dvh`, `overflow-y-auto`, backdrop tap-to-close. Desktop: anchor-relative, `maxHeight: 360`. Guest: roles section hidden entirely.

**LocationTile** — Theme-aware via MutationObserver. `border: none` override on BentoCard.

**AboutMapTile** — CDN Mapbox, theme-aware (`outdoors-v12` / `dark-v11`), MutationObserver.

**Calendar** — `--cal-height: calc(100dvh - 244px)` mobile / `calc(100dvh - 196px)` desktop. Period order: AGENDA → DAY → WEEK → MONTH.

**Navigation** — Public: `/`, `/about`, `/calendar`, `/trips`. Auth: `/profile`, `/notifications`, `/los`, `/guides`, `/admin`. Nav casing: `tracking-widest uppercase` all languages.

---

## 7. LOS & Notifications

- `notify_role_request`: admins + Core ancestors of requester
- `notify_trip_created`: all member/core/admin
- `run_los_digest`: pg_cron daily 06:00 UTC
- `get_core_ancestors(uuid)`: ltree → Core profile UUIDs
- LOS tree response: `{ scope, nodes, caller_abo }` — extract `.nodes` before `buildTree`.
- No-ABO label: `p_<uuid_no_hyphens>`. LOS import always wins for positioning.

---

## 8. Environment Variables

| Var | Status |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ |
| `CLERK_SECRET_KEY` | ✅ |
| `CLERK_WEBHOOK_SECRET` | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ server-only |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ |
| `ICAL_TOKEN_SECRET` | ✅ |
| `NEXT_PUBLIC_APP_URL` | `https://tevd-portal.vercel.app` |
| `INSTAGRAM_ACCESS_TOKEN` | ⏳ pending |
| `FB_PAGE_ACCESS_TOKEN` | ⏳ pending |
| `FB_PAGE_ID` | ⏳ pending |

---

## 9. Pending Issues

| ID | Name | Priority | Status | Blocked By |
|---|---|---|---|---|
| ISS-0056 | Meta token expiry alert + refresh flow | Low | Blocked | FB_APP_ID + FB_APP_SECRET missing |
| ISS-0125 | Design revisit: inner pages mobile layout | P2 | Needs Design | — |
| ISS-0172 | Admin social posts: URL preview / manual override UI | Low | To Do | ISS-0157 ✓ |
| ISS-0178 | /profile bento drag/drop + collapsible, persisted to ui_prefs | P2 | To Do | — |

---

## 10. Releases

| Version | Date | Notes |
|---|---|---|
| v1.0.0 | 2026-03-01 | Core Auth & LOS |
| v1.2.0 | 2026-03-16 | Calendar rewrite, approval hub, member profiles |
| v1.3.0 | 2026-03-18 | Admin CRUD, QA, LOS views, Core notifications |
| v1.4.0 | 2026-03-18 | About page, mobile overhaul, EET formatting |
| v1.4.1 | 2026-03-19 | Profile crash guard, webhook guest default, SSU |
| v1.5.0 | 2026-03-19 | Profile overhaul, BottomNav removal, verification paths |
| v1.6.0 | 2026-03-20 | social_posts, vital signs, LOS Tree fix, role colors, Clerk sync |
| v1.7.0 | 2026-03-21 | /trips registered UX, calendar fixes, profile 2-col, i18n hardening |
| v1.7.1 | 2026-03-21 | About page fixes, profile section renames, admin navbar |
| v1.7.2 | 2026-03-21 | Supabase types regen, CI type-check workflow |
| v1.8.0 | 2026-03-21 | Generic payments (payable_items + payments + cancel + ui_prefs), /profile bento split, 8 new API routes |

Latest stable commit: `e655376`
