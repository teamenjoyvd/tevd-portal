# REF.md — teamenjoyVD Portal Reference
> Read on demand at GATHER only. Never read at SSU.
> Pull only the sections the ticket needs.

## Section Map

| Section | Read when ticket touches |
|---|---|
| §1 Key Files & Patterns | `lib/`, `components/`, established patterns |
| §2 Navigation | Header, Footer, `lib/nav.ts` |
| §3 Admin Pages | Any `/admin/*` page |
| §4 Directory Tree | New files, new routes, component moves |
| §5 Schema | DB, migrations, `types/supabase.ts` |
| §6 API & RPC Map | Any API route, TanStack Query fetch |
| §7 Design System | Bento, tokens, colors, layout |
| §8 i18n & Regional | `translations.ts`, `t()`, `lib/format.ts` |
| §9 Env Vars | New secrets, deployment config |
| §10 Airtable Field IDs | Airtable writes |

---

## §1 Key Files & Patterns

**`lib/nav.ts`** — single source for all navigation. Never hardcode nav labels in components.
```ts
PUBLIC_NAV        // Home, About, Calendar, Trips
MEMBER_NAV        // Guides, My Network (/los), Profile (/profile)
FOOTER_MEMBER_NAV // MEMBER_NAV minus /los
ADMIN_NAV         // Approval Hub, Operations, Calendar, Content, Notifications, Members
```
Nav labels use `labels: { en, bg }` inline — NOT `t()`.

**`lib/format.ts`** — EET/EEST regional formatting. Always import from here, never inline `toLocaleDateString` or Intl.
```ts
formatDate(iso)      // 18.03.2026
formatShortDate(iso) // 18.03.
formatLongDate(iso)  // Сряда, 18.03.2026
formatTime(iso)      // 14:30
formatDateTime(iso)  // 18.03.2026, 14:30
formatCurrency(n)    // 1.234,00 €
calDay(iso)          // 18
calMonth(iso)        // MAR
```

**`lib/hooks/useTheme.ts`** — returns `{ theme, mounted, toggle }`. Same-tab sync: `tevd-theme-change` CustomEvent. Cross-tab: `StorageEvent`. Key: `tevd-theme`.

**`lib/role-colors.ts`** — always `getRoleColors(role)`, never hardcode role bg/font inline.

**`lib/supabase/service.ts`** — singleton service role client. Do not instantiate per request.

**`lib/email/send.ts`** — two public dispatchers:
- `sendNotificationEmail(payload)` — `Promise<void>`, fire-and-forget, respects `email_config` gates, errors swallowed to `email_log`.
- `sendTransactionalEmail(payload)` — `Promise<TransactionalEmailResult>`, bypasses gates, caller checks `result.sent`. Use when the email IS the feature (magic links, access links).

**`components/ui/Drawer.tsx`** — right slide-over. Props: `open`, `onClose`, `title`, `children`. Use for ALL admin create/edit forms. Exceptions: Announcements + Quick Links create = inline cards. All deletes use `AlertDialog`.

**`components/events/EventPopup.tsx`**
- Mobile (<768px): fixed bottom sheet, `85dvh` max, drag handle, backdrop tap-to-close.
- Desktop: anchor-relative popover, viewport-clamped, `maxHeight: 360`.
- Guest: roles section hidden.

---

## §2 Navigation

- Desktop nav breakpoint: `lg` (1024px). Mobile hamburger: `lg:hidden`. **Not `md`.**
- Public routes: `/`, `/about`, `/calendar`, `/trips`.
- Auth-only: `/profile`, `/notifications`, `/los`, `/guides`, `/admin`.
- Nav color: `var(--text-nav)` → `var(--brand-parchment)` in dark mode.
- Footer: Home → About → Calendar → Trips → Guides → Profile. 3-col layout: brand | nav | socials.
- Footer bottom bar: `© 2026 teamenjoyVD · All rights reserved | Built with ♥ by Vera & Deniz in Sofia.`
- **NO BottomNav. Mobile nav = hamburger only.**

---

## §3 Admin Pages

| Page | Notes |
|---|---|
| `/admin/approval-hub` | ABO + manual verification + Path C direct-verify |
| `/admin/calendar` | Events ascending by `start_time`. Create/edit via Drawer. |
| `/admin/content` | Tabs: Announcements \| Quick Links \| Guides \| Social Posts \| Bento. Edit via Drawer. |
| `/admin/data-center` | LOS import + reconciliation panel |
| `/admin/notifications` | All-time audit log incl. soft-deleted, paginated 50/page |
| `/admin/operations` | URL-param tabs: `?tab=trips\|items\|payments`. All create/edit via Drawer. |
| `/admin/payable-items` | `redirect()` → `/admin/operations?tab=items` |

Operations payments tab: Log Payment Drawer with `<optgroup>` entity select; member selector from `/api/admin/members`; status filter pills; pending member submissions at top.

---

## §4 Directory Tree

```
/app
  /(dashboard)
    /page.tsx                      # Homepage — 12-col BentoGrid, RSC
    /about/page.tsx                # CANONICAL dual-layout reference
    /trips/page.tsx
    /trips/[id]/page.tsx           # Auth-gated, registered users only
    /profile/page.tsx              # Multi-bento, drag/drop reorder + collapsible
    /components/tiles/
      CalendarTile.tsx             # 'use client', useQuery /api/calendar
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
    /payable-items/page.tsx        # redirect → /admin/operations?tab=items
  /api
    /admin/announcements/route.ts
    /admin/calendar/route.ts
    /admin/calendar-sync/route.ts  # POST — triggers sync-google-calendar edge function
    /admin/email-log/route.ts      # GET — email_log audit (admin only)
    /admin/event-role-requests/route.ts
    /admin/event-role-requests/[id]/route.ts
    /admin/guides/route.ts
    /admin/guides/[id]/route.ts
    /admin/guides/upload/route.ts
    /admin/home-settings/route.ts  # GET, PATCH — home_settings table
    /admin/links/route.ts
    /admin/links/[id]/route.ts
    /admin/los-import/route.ts     # POST — imports LOS CSV via import_los_members RPC
    /admin/los-tree/route.ts       # GET — returns tree nodes for admin LOS view
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
    /admin/settings/route.ts       # GET, PATCH — settings table (key/value config)
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
    /calendar/feed.ics/route.ts    # GET — iCal feed; JWT token auth; emits UTC DTSTART:...Z
    /calendar/feed-token/route.ts  # GET/POST — issue/regenerate iCal subscription token
    /events/[id]/register/route.ts # POST — guest registration (public)
    /guides/route.ts
    /home/route.ts                 # GET — home_settings for homepage RSC
    /links/route.ts                # GET — active links for member view
    /los/tree/route.ts             # GET — member LOS tree
    /notifications/route.ts        # GET, PATCH — own notifications
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
  /layout/BottomNav.tsx            # DEAD STUB — do not import
  /ui/Drawer.tsx
/lib
  /format.ts
  /hooks/useTheme.ts
  /hooks/useLanguage.ts
  /hooks/useNotifications.ts
  /nav.ts
  /role-colors.ts
  /og-scrape.ts                   # Server-only. Returns nulls for IG/FB URLs.
  /supabase/client.ts
  /supabase/server.ts
  /supabase/service.ts
  /i18n/translations.ts
  /email/send.ts
  /actions/guest-registration.ts  # Server action — magic link via sendTransactionalEmail
/styles/brand-tokens.css
/proxy.ts                         # Auth middleware — NEVER create middleware.ts
/.github/workflows/check-types.yml
/docs/ai/REF.md
/docs/architecture/C4.md
/docs/architecture/FLOWS.md
/docs/architecture/DECISIONS.md
/supabase/migrations/
/supabase/functions/sync-google-calendar/index.ts  # Edge function — GCal sync
/types/supabase.ts
```

### /profile bento inventory

| ID | Col-span | Renders when |
|---|---|---|
| `personal` | col-12 | always (pinned, index 0) |
| `trips` | col-6 | hasTrips |
| `payments` | col-6 | always |
| `vitals` | col-6 | hasVitals |
| `participation` | col-6 | hasEventRoles |
| `calendar` | col-12 | always |
| `stats` | col-12 | abo_number present |
| `admin` | col-12 | role === 'admin' |

---

## §5 Schema

> Live schema is always the source of truth. Run `Supabase:list_tables` before touching any table.

**`profiles`** — `id, clerk_id, first_name, last_name, display_names, role, abo_number, upline_abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, phone, contact_email, created_at, ui_prefs`
- `role` default: `'guest'`
- `ui_prefs` JSONB NOT NULL default `{}` — shape: `{ bento_order: string[], bento_collapsed: Record<string, boolean> }`

**`payments`** — `id, profile_id, trip_id, payable_item_id, amount, currency, transaction_date, admin_status, member_status, admin_reject_reason, member_reject_reason, payment_method, proof_url, note, admin_note, logged_by_admin, properties, created_at`
- Exactly one of `trip_id` / `payable_item_id` non-null.
- GREEN = both statuses `'approved'`.
- ⚠️ Two FKs to `profiles` — PostgREST join MUST use `profiles!profile_id(...)`.

**`trips`** — `id, title, description, destination, start_date, end_date, access_roles, accommodation_type, currency, image_url, inclusions, location, milestones, total_cost, trip_type, created_at`
- `access_roles`: array of role strings. PostgREST filter: `.contains('access_roles', [role])`

**`trip_registrations`** — `id, trip_id, profile_id, status, created_at, updated_at, cancelled_at, cancelled_by`
- `status`: `pending | approved | denied`. No `cancelled` value. Cancelled signal: `cancelled_at IS NOT NULL`.

**`trip_attachments`** — `id, trip_id, created_by, file_name, file_type, file_url, sort_order, created_at`

**`trip_messages`** — `id, trip_id, created_by, body, created_at, updated_at`

**`event_role_requests`** — `id, event_id, profile_id, role_label, status, created_at, updated_at, note`
- `status`: `pending | approved | denied`.

**`guest_registrations`** — `id, event_id, name, email, token, status, expires_at, created_at`
- `status`: `pending | confirmed`.

**`notifications`** — `id, profile_id, is_read, type, title, message, action_url, created_at, deleted_at`
- Soft-delete: filter `deleted_at IS NULL`.

**`calendar_events`** — `id, google_event_id, title, description, location, meeting_url, start_time, end_time, category, access_roles, week_number, event_type, allow_guest_registration, available_roles, created_at, created_by`
- `location`: physical/named location from GCal `location` field (migration `20260503000000`).
- `meeting_url`: video join link extracted from conferenceData or description href.
- `access_roles` renamed from `visibility_roles` in migration `20260502075427`.

**`social_posts`** — `id, platform, post_url, caption, thumbnail_url, is_visible, is_pinned, sort_order, posted_at, created_at`
- Single pinned: partial unique index `(WHERE is_pinned=true)`. Pin swap via `pin_social_post(p_id uuid)` RPC.

**`guides`** — `id, slug, title (jsonb {en,bg}), emoji, cover_image_url, body (jsonb Block[]), access_roles, is_published, sort_order, created_at, updated_at`
- Block: `{ type: 'heading'|'paragraph'|'callout', content: {en,bg}, emoji? }`
- Cover images: bucket `guide-covers` (public).

**`payable_items`** — `id, title, description, amount, currency, item_type, linked_trip_id, is_active, created_by, created_at, properties`
- `item_type`: `'merchandise' | 'ticket' | 'food' | 'book' | 'other'`

**`announcements`** — `id, titles, contents, access_roles, is_active, sort_order, created_at`

**`links`** — `id, label (jsonb {en,bg}), url, access_roles, is_active, sort_order, created_at`

**`home_settings`** — `id, caret_1_text, caret_2_text, caret_3_text, show_caret_1, show_caret_2, show_caret_3, featured_announcement_id, updated_at`

**`bento_config`** — `tile_key, max_items, updated_at`

**`settings`** — `key, value (jsonb)` — generic key/value config store.

**`email_log`** — `id, template, recipient, payload, status, resend_id, sent_at, error, created_at`

**`vital_sign_definitions`** — `id, category, label, is_active, sort_order, created_at`
- 6 categories: N21 CONNECT, N21 CONNECT+, BBS, WES, CEP, CEP+. UNIQUE on category.

**`member_vital_signs`** — `id, profile_id, definition_id, is_active, recorded_at, note, created_at, recorded_by`
- UNIQUE on `(profile_id, definition_id)`.

**`abo_verification_requests`** — `id, profile_id, claimed_abo, claimed_upline_abo, request_type, status, admin_note, created_at, resolved_at`

**`role_change_audit`** — `id, profile_id, old_role, new_role, changed_by, note, changed_at`

**`tree_nodes`** — `id, profile_id, parent_id, path (ltree), depth, created_at`
- No-ABO label: `p_<uuid_no_hyphens>`. ABO assignment renames node → calls `rebuild_tree_paths`.

**`los_members`** — `abo_number (PK), sponsor_abo_number, name, abo_level, bonus_percent, gpv, ppv, annual_ppv, gbv, ruby_pv, customer_pv, customers, group_size, group_orders_count, personal_order_count, qualified_legs, sponsoring, points_to_next_level, phone, email, address, country, entry_date, renewal_date, last_synced_at`

---

## §6 API & RPC Map

### Member routes
| Route | Method | Notes |
|---|---|---|
| `/api/profile` | GET, PATCH | |
| `/api/profile/verify-abo` | POST | |
| `/api/profile/vitals` | GET | |
| `/api/profile/event-roles` | GET | |
| `/api/profile/los-summary` | GET | |
| `/api/profile/upline` | GET | |
| `/api/profile/payments` | GET, POST | POST triggers `sendNotificationEmail` to admin |
| `/api/profile/trips/[id]/cancel` | POST | |
| `/api/payable-items` | GET | Active items only |
| `/api/payments` | GET, POST | Unified |
| `/api/trips/[id]/payments` | GET | |
| `/api/calendar` | GET | Role-filtered; no `?month` → agenda from today |
| `/api/calendar/feed.ics` | GET | iCal feed; `?token=` JWT auth; emits `location` + `url` (meeting_url) |
| `/api/calendar/feed-token` | GET, POST | Issue/regenerate iCal subscription token |
| `/api/guides` | GET | Published, access_roles respected |
| `/api/links` | GET | Active links, role-filtered |
| `/api/home` | GET | home_settings for homepage RSC |
| `/api/los/tree` | GET | Member LOS tree |
| `/api/notifications` | GET, PATCH | Own notifications; PATCH marks read |
| `/api/socials` | GET | |
| `/api/events/[id]/register` | POST | Guest event registration (public) |
| `/api/webhooks/clerk` | POST | User lifecycle |

### Admin routes
| Route | Method | Notes |
|---|---|---|
| `/api/admin/announcements` | GET, POST, PATCH, DELETE | |
| `/api/admin/calendar` | GET, POST, PATCH, DELETE | |
| `/api/admin/calendar-sync` | POST | Triggers sync-google-calendar edge function |
| `/api/admin/email-log` | GET | email_log audit (admin only) |
| `/api/admin/event-role-requests` | GET | Flat join, no N+1 |
| `/api/admin/event-role-requests/[id]` | PATCH | |
| `/api/admin/guides` | GET, POST | |
| `/api/admin/guides/[id]` | GET, PATCH, DELETE | |
| `/api/admin/guides/upload` | POST | Uploads to `guide-covers` bucket |
| `/api/admin/home-settings` | GET, PATCH | home_settings table |
| `/api/admin/links` | GET, POST | |
| `/api/admin/links/[id]` | PATCH, DELETE | |
| `/api/admin/los-import` | POST | Imports LOS CSV via `import_los_members` RPC |
| `/api/admin/los-tree` | GET | Tree nodes for admin LOS view |
| `/api/admin/members` | GET | LOS + profiles + pending verifications + guests |
| `/api/admin/members/[id]` | GET, PATCH | PATCH: role update MUST sync Clerk metadata |
| `/api/admin/members/[id]/vital-signs` | GET, POST | |
| `/api/admin/members/[id]/vital-signs/[definitionId]` | PATCH, DELETE | |
| `/api/admin/payable-items` | GET, POST | |
| `/api/admin/payable-items/[id]` | PATCH, DELETE | |
| `/api/admin/payments` | GET, POST | |
| `/api/admin/payments/[id]` | PATCH | Triggers `sendNotificationEmail` |
| `/api/admin/quick-links` | GET, POST | |
| `/api/admin/quick-links/[id]` | PATCH, DELETE | |
| `/api/admin/registrations` | GET | Flat join, no N+1 |
| `/api/admin/registrations/[id]` | PATCH | Triggers `sendNotificationEmail` |
| `/api/admin/settings` | GET, PATCH | settings key/value table |
| `/api/admin/social-posts` | GET, POST | |
| `/api/admin/social-posts/[id]` | PATCH, DELETE | |
| `/api/admin/social-posts/preview` | GET | OG scrape `?url=` |
| `/api/admin/trips` | GET, POST | |
| `/api/admin/trips/[id]` | GET, PATCH, DELETE | |
| `/api/admin/trips/registrations/[id]/cancel` | POST | Triggers `sendNotificationEmail` |
| `/api/admin/verify` | POST | ABO approve/deny — MUST sync Clerk metadata |
| `/api/admin/vital-sign-definitions` | GET, POST | |
| `/api/admin/vital-sign-definitions/[id]` | PATCH, DELETE | |

### Supabase RPCs
| RPC | Purpose |
|---|---|
| `pin_social_post(p_id uuid)` | Atomic pin swap |
| `get_core_ancestors(uuid)` | Core-role UUIDs above a node |
| `rebuild_tree_paths` | Cascade ABO label rename to descendants |
| `approve_member_verification(p_request_id, p_admin_note?)` | Approve ABO verification request |
| `patch_member_role(p_profile_id, p_new_role, p_changed_by, p_note?)` | Role update with audit trail — returns updated profile |
| `get_trip_team_attendees(p_trip_id, p_viewer_profile)` | Returns Core/admin attendees for a trip |
| `import_los_members(rows jsonb)` | Bulk upsert LOS data |
| `get_los_members_with_profiles` | Joined LOS + profile data for admin view |
| `notify_role_request` | Fan-out to admins + Core ancestors |
| `notify_trip_created` | Fan-out to all member/core/admin |
| `notify_calendar_event_created` | Fan-out to descendants + Core ancestors (Core-created only) |
| `run_los_digest` | pg_cron daily 06:00 UTC |

---

## §7 Design System

All tokens: `styles/brand-tokens.css`. Role colors: `getRoleColors(role)` from `lib/role-colors.ts`.

### Brand Palette
| Token | Value | Usage |
|---|---|---|
| `--brand-forest` | `#2d332a` | Hero, nav, map tile, footer |
| `--brand-crimson` | `#bc4749` | CTAs, eyebrow labels, notification dots |
| `--brand-teal` | `#3E7785` | Links tile, sign-in button |
| `--brand-parchment` | `#FAF8F3` | Page bg |
| `--brand-void` | `#1A1F18` | Primary text |
| `--brand-oyster` | `#F0EDE6` | Card surfaces |
| `--brand-stone` | `#8A8577` | Secondary text, timestamps |

### Semantic Tokens
| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#1A1F18` | `#FAF8F3` |
| `--text-secondary` | `#5C5950` | `#B5B0A8` |
| `--text-nav` | `var(--text-secondary)` | `var(--brand-parchment)` |
| `--bg-global` | `#FAF8F3` | `#1A1F18` |
| `--bg-global-rgb` | `250, 248, 243` | `26, 31, 24` ⚠️ |
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

### BentoCard variants
`default` | `forest` | `crimson` | `teal` | `edge-info` | `edge-alert`

### BentoGrid
- `grid-template-columns: repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Wrapper: `max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8`
- Mobile: `.bento-mobile-full` = `grid-column: 1/-1 !important` | `.bento-mobile-half` = `span 6 !important`
- Eyebrow default: `var(--brand-crimson)`. On teal/forest: `style={{ color: 'var(--brand-parchment)' }}`.

### Homepage Grid
```
ROW 1: Hero(col-5,forest) | Profile(col-2) | About(col-2) | Calendar(col-3,rowSpan=2)
ROW 2: Trip(col-3,crimson)* | Announcement(col-3)* | LinksGuides(col-3,teal,rowSpan=2) | Calendar*
ROW 3: Theme(col-2) | FontSize(col-2) | Map(col-2,forest) | LinksGuides* | Socials(col-3)
* = conditionally rendered (null when empty). Calendar always renders.
Mobile order: Hero→Announcement→Profile→Calendar→Trip→Theme→FontSize→Map→Socials→About→LinksGuides
```

### Calendar CSS
```css
:root { --cal-height: calc(100dvh - 244px); }
@media (min-width: 768px) { --cal-height: calc(100dvh - 196px); }
```
Period selector order: AGENDA → DAY → WEEK → MONTH

---

## §8 i18n & Regional Standards

- Dates: `DD.MM.YYYY`. Time: 24h. Currency: `1.234,56 €`. Week starts Monday.
- Always `lib/format.ts` — never inline.
- `TranslationKey` is a strict union. Add to `translations.ts` before using `t()` or build breaks.
- Locales: `en`, `bg`. Nav labels use `labels: { en, bg }` in `lib/nav.ts` — NOT `t()`.
- Role hierarchy: `admin > core > member > guest`.
- Public routes (no auth): `/`, `/about`, `/calendar`, `/trips`.

---

## §9 Env Vars

| Var | Status |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ |
| `CLERK_SECRET_KEY` | ✅ |
| `CLERK_WEBHOOK_SECRET` | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ server-only |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ `pk.` prefix |
| `ICAL_TOKEN_SECRET` | ✅ |
| `NEXT_PUBLIC_APP_URL` | `https://tevd-portal.vercel.app` |
| `RESEND_API_KEY` | ✅ |
| `INSTAGRAM_ACCESS_TOKEN` | ⏳ pending |
| `FB_PAGE_ACCESS_TOKEN` | ⏳ pending |
| `FB_PAGE_ID` | ⏳ pending |

---

## §10 Airtable Field IDs

**Base:** `app1n7KYX8i8xSiB7` — **Table:** `tblUq45Wo3xngSf3w`

| Field | ID |
|---|---|
| Issue ID | `fldE1F4ViLRQml5Hw` |
| Seq (PK) | `fldnKdNxb4YjdHoIf` |
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
