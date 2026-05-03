# LOOKUP.md — teamenjoyVD Portal Reference Tables
> Last updated: 2026-05-03
> **Read on demand in GATHER only. Never read at SSU or at GATHER start.**
> Pull only the sections the ticket needs. See section map in REF.md header.

---

## 1. Directory Tree

```
/app
  /(dashboard)
    /page.tsx                    # Homepage — 12-col BentoGrid server component
    /about/page.tsx              # CANONICAL dual-layout reference
    /trips/page.tsx
    /trips/[id]/page.tsx         # Trip detail — auth-gated, registered users only
    /profile/page.tsx            # Multi-bento layout, drag/drop reorder + collapsible
    /components/tiles/
      CalendarTile.tsx           # 'use client' — useQuery /api/calendar, isLoaded gate, never null
      FontSizeTile.tsx
      GuidesTile.tsx
      LinksGuidesTile.tsx
      LocationTileLazy.tsx
      ProfileTile.tsx
      SocialsTile.tsx
      ThemeTile.tsx
  /admin
    /approval-hub/page.tsx
    /calendar/page.tsx
    /content/page.tsx
    /data-center/page.tsx
    /notifications/page.tsx
    /operations/page.tsx
    /payable-items/page.tsx      # redirect → /admin/operations?tab=items
  /api
    /admin/announcements/route.ts
    /admin/calendar/route.ts
    /admin/calendar-sync/route.ts
    /admin/email-log/route.ts
    /admin/event-role-requests/route.ts
    /admin/event-role-requests/[id]/route.ts
    /admin/guides/route.ts
    /admin/guides/[id]/route.ts
    /admin/guides/upload/route.ts
    /admin/home-settings/route.ts
    /admin/links/route.ts
    /admin/links/[id]/route.ts
    /admin/los-import/route.ts
    /admin/los-tree/route.ts
    /admin/members/route.ts
    /admin/members/[id]/route.ts
    /admin/members/[id]/vital-signs/route.ts
    /admin/members/[id]/vital-signs/[definitionId]/route.ts
    /admin/payable-items/route.ts
    /admin/payable-items/[id]/route.ts
    /admin/payments/route.ts
    /admin/payments/[id]/route.ts
    /admin/quick-links/route.ts
    /admin/quick-links/[id]/route.ts
    /admin/registrations/route.ts
    /admin/registrations/[id]/route.ts
    /admin/settings/route.ts
    /admin/social-posts/route.ts
    /admin/social-posts/[id]/route.ts
    /admin/social-posts/preview/route.ts
    /admin/trips/route.ts
    /admin/trips/[id]/route.ts
    /admin/trips/registrations/[id]/cancel/route.ts
    /admin/verify/route.ts
    /admin/vital-sign-definitions/route.ts
    /admin/vital-sign-definitions/[id]/route.ts
    /calendar/route.ts
    /calendar/feed.ics/route.ts  # GET — iCal feed; JWT token auth
    /calendar/feed-token/route.ts # GET/POST — issue/regenerate token
    /events/[id]/register/route.ts
    /guides/route.ts
    /home/route.ts
    /links/route.ts
    /los/tree/route.ts
    /notifications/route.ts
    /payable-items/route.ts
    /payments/route.ts
    /profile/payments/route.ts
    /profile/route.ts
    /profile/verify-abo/route.ts
    /profile/vitals/route.ts
    /profile/event-roles/route.ts
    /profile/los-summary/route.ts
    /profile/upline/route.ts
    /profile/trips/[id]/cancel/route.ts
    /trips/[id]/payments/route.ts
    /socials/route.ts
    /webhooks/clerk/route.ts
/components
  /about/AboutMapTile.tsx
  /bento/BentoCard.tsx
  /bento/BentoGrid.tsx
  /bento/tiles/LocationTile.tsx
  /bento/tiles/ThemeTile.tsx
  /events/EventPopup.tsx
  /layout/Footer.tsx
  /layout/Header.tsx
  /layout/UserDropdown.tsx
  /layout/UserPopup.tsx
  /layout/BottomNav.tsx          # DEAD STUB — do not import
  /ui/Drawer.tsx
/lib
  /format.ts
  /hooks/useTheme.ts
  /hooks/useLanguage.ts
  /hooks/useNotifications.ts
  /nav.ts
  /role-colors.ts
  /og-scrape.ts
  /supabase/client.ts
  /supabase/server.ts
  /supabase/service.ts
  /i18n/translations.ts
  /email/send.ts
  /actions/guest-registration.ts
/styles/brand-tokens.css
/.github/workflows/check-types.yml
/docs/ai/REF.md
/docs/ai/LOOKUP.md
/docs/architecture/C4.md
/docs/architecture/FLOWS.md
/docs/architecture/DECISIONS.md
/supabase/migrations/
/supabase/functions/sync-google-calendar/index.ts
/types/supabase.ts
```

### /profile bento inventory

| Bento | ID | Col-span | Renders when |
|---|---|---|---|
| A: Personal Details | `personal` | col-12 | always (pinned, index 0) |
| B: Trips | `trips` | col-6 | hasTrips |
| C: Payments | `payments` | col-6 | always |
| D: Vital Signs | `vitals` | col-6 | hasVitals |
| E: Participation | `participation` | col-6 | hasEventRoles |
| F: Calendar Subscription | `calendar` | col-12 | always |
| G: Stats | `stats` | col-12 | abo_number present |
| H: Admin Tools | `admin` | col-12 | role === 'admin' |

---

## 2. Schema

> Live schema is always the source of truth. Use `Supabase:list_tables verbose` before touching any table.

**`profiles`**
`id, clerk_id, first_name, last_name, display_names, role, abo_number, upline_abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, phone, contact_email, created_at, ui_prefs`
- `role` default: `'guest'`
- `ui_prefs` JSONB NOT NULL default `{}` — shape: `{ bento_order: string[], bento_collapsed: Record<string, boolean> }`

**`guides`**
`id, slug, title (jsonb {en,bg}), emoji, cover_image_url, body (jsonb Block[]), access_roles, is_published, sort_order, created_at, updated_at`
- Block shape: `{ type: 'heading'|'paragraph'|'callout', content: {en,bg}, emoji? }`
- Cover images: Supabase Storage bucket `guide-covers` (public).

**`payable_items`**
`id, title, description, amount, currency, item_type, linked_trip_id, is_active, created_by, created_at, properties`
- `item_type`: `'merchandise' | 'ticket' | 'food' | 'book' | 'other'`
- `properties` JSONB NOT NULL default `{}`

**`payments`** (unified)
`id, profile_id, trip_id, payable_item_id, amount, currency, transaction_date, admin_status, member_status, admin_reject_reason, member_reject_reason, payment_method, proof_url, note, admin_note, logged_by_admin, properties, created_at`
- Entity constraint: exactly one of `trip_id` / `payable_item_id` non-null.
- GREEN state = both `admin_status` and `member_status` = `'approved'`.
- ⚠️ **FK ambiguity:** two FKs to `profiles`. Any PostgREST join MUST use `profiles!profile_id(...)`.

**`trips`**
`id, title, description, destination, start_date, end_date, access_roles, accommodation_type, currency, image_url, inclusions, location, milestones, total_cost, trip_type, created_at`
- `access_roles`: array of role strings controlling who can see the trip.
- PostgREST visibility filter: `.contains('access_roles', [role])`

**`trip_registrations`**
`id, trip_id, profile_id, status, created_at, updated_at, cancelled_at, cancelled_by`
- `status` enum: `pending | approved | denied`. No `cancelled` value.
- Cancelled signal: `cancelled_at IS NOT NULL`.

**`trip_attachments`**
`id, trip_id, created_by, file_name, file_type, file_url, sort_order, created_at`

**`trip_messages`**
`id, trip_id, created_by, body, created_at, updated_at`

**`event_role_requests`**
`id, event_id, profile_id, role_label, status, created_at, updated_at, note`
- `status` enum: `pending | approved | denied`.

**`guest_registrations`**
`id, event_id, name, email, token, status, expires_at, created_at`
- `status`: `pending | confirmed`.

**`notifications`**
`id, profile_id, is_read, type (enum), title, message, action_url, created_at, deleted_at`
- Soft-delete: `deleted_at IS NULL` on user queries.

**`calendar_events`**
`id, google_event_id, title, description, location, meeting_url, start_time, end_time, category, access_roles, week_number, event_type, allow_guest_registration, available_roles, created_at, created_by`
- `location`: physical/named location from GCal `location` field (added migration `20260503000000`).
- `meeting_url`: video join link (conferenceData or description href).
- `access_roles` renamed from `visibility_roles` in migration `20260502075427`.
- iCal export: `location` → `LOCATION`, `meeting_url` → `URL`.

**`social_posts`**
`id, platform, post_url, caption, thumbnail_url, is_visible, is_pinned, sort_order, posted_at, created_at`
- Single pinned post: partial unique index `social_posts_single_pinned (WHERE is_pinned=true)`.
- Pin swap via `pin_social_post(p_id uuid)` RPC — atomic.

**`announcements`**
`id, titles, contents, access_roles, is_active, sort_order, created_at`

**`links`**
`id, label (jsonb {en,bg}), url, access_roles, is_active, sort_order, created_at`

**`home_settings`**
`id, caret_1_text, caret_2_text, caret_3_text, show_caret_1, show_caret_2, show_caret_3, featured_announcement_id, updated_at`

**`bento_config`**
`tile_key, max_items, updated_at`

**`settings`**
`key, value (jsonb)` — generic key/value config store.

**`email_log`**
`id, template, recipient, payload, status, resend_id, sent_at, error, created_at`

**`vital_sign_definitions`**
`id, category, label, is_active, sort_order, created_at`
- 6 categories: N21 CONNECT, N21 CONNECT+, BBS, WES, CEP, CEP+. UNIQUE on category.

**`member_vital_signs`**
`id, profile_id, definition_id, is_active, recorded_at, note, created_at, recorded_by`
- UNIQUE on `(profile_id, definition_id)`.

**`abo_verification_requests`**
`id, profile_id, claimed_abo, claimed_upline_abo, request_type, status, admin_note, created_at, resolved_at`
- `request_type`: `'standard' | 'manual'`

**`role_change_audit`**
`id, profile_id, old_role, new_role, changed_by, note, changed_at`

**`tree_nodes`**
`id, profile_id, parent_id, path (ltree), depth, created_at`
- No-ABO label: `p_<uuid_no_hyphens>`. Renamed on ABO assignment → `rebuild_tree_paths` called.

**`los_members`**
`abo_number (PK), sponsor_abo_number, name, abo_level, bonus_percent, gpv, ppv, annual_ppv, gbv, ruby_pv, customer_pv, customers, group_size, group_orders_count, personal_order_count, qualified_legs, sponsoring, points_to_next_level, phone, email, address, country, entry_date, renewal_date, last_synced_at`

---

## 3. API / RPC Map

### Member-facing routes
| Route | Method | Purpose |
|---|---|---|
| `/api/profile` | GET, PATCH | Read/update own profile |
| `/api/profile/verify-abo` | POST | Submit ABO verification request |
| `/api/profile/vitals` | GET | Read own vital signs |
| `/api/profile/event-roles` | GET | Read own event participation |
| `/api/profile/los-summary` | GET | Read own LOS downline |
| `/api/profile/upline` | GET | Read own upline |
| `/api/profile/payments` | GET, POST | Read/submit own payments — POST triggers admin alert via `sendNotificationEmail` |
| `/api/profile/trips/[id]/cancel` | POST | Cancel own trip registration |
| `/api/payable-items` | GET | List active payable items |
| `/api/payments` | GET, POST | Unified payment read/submit |
| `/api/trips/[id]/payments` | GET | Payments for a specific trip |
| `/api/calendar` | GET | Role-filtered events; no `?month` → agenda from today |
| `/api/calendar/feed.ics` | GET | iCal feed; `?token=` JWT auth; emits `LOCATION` + `URL` |
| `/api/calendar/feed-token` | GET, POST | Issue/regenerate iCal subscription token |
| `/api/guides` | GET | Published guides (access_roles respected) |
| `/api/links` | GET | Active links (role-filtered) |
| `/api/home` | GET | home_settings for homepage RSC |
| `/api/los/tree` | GET | Member LOS tree |
| `/api/notifications` | GET, PATCH | Own notifications; PATCH marks read |
| `/api/socials` | GET | Social posts |
| `/api/events/[id]/register` | POST | Guest event registration (public) |
| `/api/webhooks/clerk` | POST | Clerk user lifecycle webhook |

### Admin routes
| Route | Method | Purpose |
|---|---|---|
| `/api/admin/announcements` | GET, POST, PATCH, DELETE | Announcements CRUD |
| `/api/admin/calendar` | GET, POST, PATCH, DELETE | Calendar event CRUD |
| `/api/admin/calendar-sync` | POST | Triggers sync-google-calendar edge function |
| `/api/admin/email-log` | GET | email_log audit (admin only) |
| `/api/admin/event-role-requests` | GET | All event_role_requests joined with profile + calendar_events — no N+1 |
| `/api/admin/event-role-requests/[id]` | PATCH | Update role request status |
| `/api/admin/guides` | GET, POST | List + create guides |
| `/api/admin/guides/[id]` | GET, PATCH, DELETE | Guide CRUD |
| `/api/admin/guides/upload` | POST | Upload cover image to `guide-covers` bucket |
| `/api/admin/home-settings` | GET, PATCH | home_settings table |
| `/api/admin/links` | GET, POST | List + create links |
| `/api/admin/links/[id]` | PATCH, DELETE | Update/delete link |
| `/api/admin/los-import` | POST | Imports LOS CSV via `import_los_members` RPC |
| `/api/admin/los-tree` | GET | Tree nodes for admin LOS view |
| `/api/admin/members` | GET | LOS members + profiles + pending verifications + guests |
| `/api/admin/members/[id]` | GET, PATCH | Member profile + unified data |
| `/api/admin/members/[id]/vital-signs` | GET, POST | Read/record vital signs for member |
| `/api/admin/members/[id]/vital-signs/[definitionId]` | PATCH, DELETE | Update/remove vital sign record |
| `/api/admin/payable-items` | GET, POST | List + create payable items |
| `/api/admin/payable-items/[id]` | PATCH, DELETE | Update/deactivate item |
| `/api/admin/payments` | GET, POST | All payments + log payment |
| `/api/admin/payments/[id]` | PATCH | Update admin_status + admin_note — triggers `sendNotificationEmail` |
| `/api/admin/quick-links` | GET, POST | List + create quick links |
| `/api/admin/quick-links/[id]` | PATCH, DELETE | Update/delete quick link |
| `/api/admin/registrations` | GET | All trip_registrations joined with profile + trip — no N+1 |
| `/api/admin/registrations/[id]` | PATCH | Update registration status — triggers `sendNotificationEmail` |
| `/api/admin/settings` | GET, PATCH | settings key/value table |
| `/api/admin/social-posts` | GET, POST | Social posts CRUD |
| `/api/admin/social-posts/[id]` | PATCH, DELETE | Update/delete post |
| `/api/admin/social-posts/preview` | GET | OG scrape (`?url=...`) |
| `/api/admin/trips` | GET, POST | List + create trips |
| `/api/admin/trips/[id]` | GET, PATCH, DELETE | Trip CRUD |
| `/api/admin/trips/registrations/[id]/cancel` | POST | Admin cancel registration — triggers `sendNotificationEmail` |
| `/api/admin/verify` | POST | Approve/deny ABO verification — MUST sync Clerk metadata |
| `/api/admin/vital-sign-definitions` | GET, POST | List + create definitions |
| `/api/admin/vital-sign-definitions/[id]` | PATCH, DELETE | Update/deactivate definition |

### Guest registration
| File | Purpose |
|---|---|
| `lib/actions/guest-registration.ts` | Server action — inserts guest token, sends magic link via `sendTransactionalEmail`. Returns `{ success: false, error }` if email fails. |

### Supabase RPCs
| RPC | Purpose |
|---|---|
| `pin_social_post(p_id uuid)` | Atomic pin swap — unpins current, pins new |
| `get_core_ancestors(uuid)` | Returns Core-role profile UUIDs above a given node |
| `rebuild_tree_paths` | Cascades ABO label rename down all descendants |
| `approve_member_verification(p_request_id, p_admin_note?)` | Approve ABO verification request |
| `patch_member_role(p_profile_id, p_new_role, p_changed_by, p_note?)` | Role update with audit trail — returns updated profile |
| `get_trip_team_attendees(p_trip_id, p_viewer_profile)` | Returns Core/admin attendees for a trip |
| `import_los_members(rows jsonb)` | Bulk upsert LOS data |
| `get_los_members_with_profiles` | Joined LOS + profile data for admin view |
| `notify_role_request` | Fan-out: admins + Core ancestors of requester |
| `notify_trip_created` | Fan-out: all member/core/admin |
| `notify_calendar_event_created` | Fan-out: descendants + Core ancestors (Core-created only) |
| `run_los_digest` | pg_cron daily 06:00 UTC — aggregates LOS activity |

---

## 4. Design System

All tokens: `styles/brand-tokens.css`. Role colors: always `getRoleColors(role)` from `lib/role-colors.ts`.

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
| `--text-nav` | `var(--text-secondary)` | `var(--brand-parchment)` |
| `--bg-global` | `#FAF8F3` | `#1A1F18` |
| `--bg-global-rgb` | `250, 248, 243` | `26, 31, 24` ⚠️ must override in dark |
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
`default` | `forest` | `crimson` | `teal` | `edge-info` | `edge-alert`

### BentoGrid
- `grid-template-columns: repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Outer wrapper: `max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8`
- Mobile: `.bento-mobile-full` = `grid-column: 1/-1 !important`, `.bento-mobile-half` = `span 6 !important`
- Eyebrow default: `var(--brand-crimson)`. On teal/forest tiles: pass `style={{ color: 'var(--brand-parchment)' }}`.

### Homepage Grid
```
ROW 1: Hero(col-5,forest) | Profile(col-2,default) | About(col-2,default) | Calendar(col-3,default,rowSpan=2)
ROW 2: Trip(col-3,crimson)* | Announcement(col-3,default)* | LinksGuides(col-3,teal,rowSpan=2) | Calendar*
ROW 3: Theme(col-2,default) | FontSize(col-2,default) | Map(col-2,forest) | LinksGuides* | Socials(col-3,default)
* = conditionally rendered — return null when empty. Calendar never returns null (empty state shown).
Mobile order: Hero→Announcement→Profile→Calendar→Trip→Theme→FontSize→Map→Socials→About→LinksGuides
```

### Calendar CSS
```css
:root { --cal-height: calc(100dvh - 244px); }
@media (min-width: 768px) { :root { --cal-height: calc(100dvh - 196px); } }
```
Period selector order: AGENDA → DAY → WEEK → MONTH

---

## 5. i18n & Regional Standards

- Dates: `DD.MM.YYYY`. Time: 24h. Currency: `1.234,56 €`. Week starts Monday.
- Always `lib/format.ts` — never inline `toLocaleDateString` or Intl.
- `TranslationKey` is strict union. Add to `translations.ts` before using `t()` or build fails.
- Supported locales: `en`, `bg`. Nav labels use `labels: { en, bg }` in `lib/nav.ts` — NOT `t()`.

### Access Control
Role hierarchy: `admin > core > member > guest`

Public (no auth): `/`, `/about`, `/calendar`, `/trips`. Auth-required: all other routes.

Every `profiles.role` update MUST also call `clerk.users.updateUserMetadata`. See FLOWS.md §1.

---

## 6. Environment Variables

| Var | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | ✅ |
| `CLERK_SECRET_KEY` | Clerk | ✅ |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signature | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service (server-only) | ✅ |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox (`pk.` prefix, public) | ✅ |
| `ICAL_TOKEN_SECRET` | iCal JWT signing | ✅ |
| `NEXT_PUBLIC_APP_URL` | Base URL | `https://tevd-portal.vercel.app` |
| `INSTAGRAM_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending |
| `FB_PAGE_ACCESS_TOKEN` | Meta Graph API | ⏳ Pending |
| `FB_PAGE_ID` | Meta Graph API | ⏳ Pending |
| `RESEND_API_KEY` | Resend email delivery | ✅ |

---

## 7. Airtable Field IDs

**Base:** `app1n7KYX8i8xSiB7` — **Issues Table:** `tblUq45Wo3xngSf3w`

| Field | ID |
|---|---|
| Issue ID | `fldE1F4ViLRQml5Hw` |
| Seq (unique PK) | `fldnKdNxb4YjdHoIf` |
| Name | `fldOSw4VEE9mXDpTm` |
| Type | `fldQN5hAQoMFdXxyl` |
| Status | `fldsTwNbtnh6SUuF0` |
| Priority | `flde5GkbsiEi4jtwq` |
| Blocked By | `fldRq9a57bHubveIx` |
| Target Files | `fld2hLIPYvrhcyiMA` |
| Definition of Done | `fld5U92AZuxpLHsuJ` |
| Claude Notes | `fldYsznuq4tUt79o4` |
| Commit Link | `fld0VWrOimUTolMIe` |
| Duplicate | `fld2P6m5fMOsi1q3G` |

| Status | Choice ID |
|---|---|
| To Do | `selO8Bg7VWY6E9sxB` |
| In Progress | `sel4MPU6wsEW7uclv` |
| Done | `selRTL4WT8qro1TnL` |
| Not relevant | `sellrX5il5BmfBxm9` |
| Needs Design | `sel98265UTlgLcw5r` |
| Blocked | `sellZeVnRByP94606` |
| Archived | `selfMrAD2qCxrMoXg` |
