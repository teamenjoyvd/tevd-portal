# CLAUDE.md — N21 Community & LOS Management Portal (teamenjoyVD)
> Last updated: March 2026 — post v1.2.0 stable release + Session 3

---

## 1. Project Overview & Operational Rules

Internal management portal for **teamenjoyVD (N21 Community)** handling Line of Sponsorship (LOS) data, team coordination, event scheduling, and trip logistics.

**Role:** Senior technical collaborator. Direct, peer-to-peer communication.

### Core Rules
- **Zero-Refactor Rule:** No logic cleanup, DRYing, or unsolicited refactoring. Preserve original line counts, formatting, and logic in all untouched areas.
- **Airtable-First Workflow:** ALWAYS query Airtable Issues table before starting any session. Check for "In Progress" first, then highest-priority unblocked "To Do".
- **Git Strategy:** Every issue concludes with a single commit following `.gitmessage` conventions. Always include the git command in the response. Always wait for the commit URL before closing the Airtable record.
- **Scope Adherence:** Only touch the files listed in `Target Files`. Do not change adjacent files unless strictly required by the DoD.

---

## 2. Airtable Project Management

### Base
- **Base ID:** `app1n7KYX8i8xSiB7` — `tevd-portal`

### Issues Table (`tblUq45Wo3xngSf3w`) — Field IDs
| Field | ID |
|---|---|
| Issue ID | `fldE1F4ViLRQml5Hw` |
| Name | `fldOSw4VEE9mXDpTm` |
| Status | `fldsTwNbtnh6SUuF0` |
| Priority | `flde5GkbsiEi4jtwq` |
| Blocked By | `fldRq9a57bHubveIx` |
| Target Files | `fld2hLIPYvrhcyiMA` |
| Definition of Done | `fld5U92AZuxpLHsuJ` |
| Claude Notes | `fldYsznuq4tUt79o4` |
| Commit Link | `fld0VWrOimUTolMIe` |

### Status Values
- `selO8Bg7VWY6E9sxB` = "To Do"
- `selRTL4WT8qro1TnL` = "Done"
- "In Progress" — use `typecast: true` when writing

### Workflow Loop
1. Check for `Status = "In Progress"` → resume if found
2. Otherwise: highest priority, unblocked `Status = "To Do"`
3. Claim: update Status → "In Progress"
4. Read CLAUDE.md. **Hard stop if missing.**
5. Note Target Files and DoD
6. Execute. Zero-Refactor.
7. Verify DoD in `<thinking>` block before output
8. Deliver files, provide git commit command
9. Wait for commit URL, then: Status → Done, write Commit Link + Claude Notes

---

## 3. Tech Stack & Infrastructure

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.1.6 (App Router) + React 19 | Turbopack enabled |
| Auth | Clerk | Custom JWT template `supabase` using `user_id` and `user_role`. `afterSignOutUrl` on `ClerkProvider`. `UserButton` replaced by custom `UserDropdown`. |
| Database | Supabase (PostgreSQL 17) | DB only. RLS enabled. LTree + pg_cron + pg_net. |
| State | TanStack Query v5 | `QueryClientProvider` in `app/providers.tsx`. 15s polling for notifications. |
| Styling | Tailwind CSS v4 | Mobile-first. **No `@layer components` with `@apply`** — inline all utility classes. |
| Fonts | Cormorant Garamond (display) + DM Sans (body) | `--font-cormorant` → `font-display`, `--font-dm-sans` → `font-body`. Playfair Display and Montserrat are still loaded (legacy vars `--font-playfair`, `--font-montserrat` present) but no longer used in any component. |
| Maps | Mapbox GL JS (CDN, mapbox-gl@2) | `NEXT_PUBLIC_MAPBOX_TOKEN` env var (public `pk.` token). Used in LocationTile. Always load via CDN `<script>` tag — do not import as npm package (SSR incompatible). Fallback to static tile if token missing. |
| Middleware | `proxy.ts` | Next.js 16 convention. NEVER create `middleware.ts`. |
| Deployment | Vercel | Team: `teamenjoyvd`. Project: `tevd-portal`. |

### Key Infrastructure IDs
- Supabase project: `ynykjpnetfwqzdnsgkkg` (eu-west-1)
- Vercel project: `prj_HFZJZg2vkLtpX8XvjJlo3mDkSCyn`
- Vercel team: `team_1vvskKJStqVCZsgxXlw3FwZH`

---

## 4. Repository & Deployment

- **Repo:** `https://github.com/teamenjoyvd/tevd-portal.git` (private)
- **Production:** `https://tevd-portal.vercel.app`
- **Branch strategy:** single `main` branch

---

## 5. Project Directory Structure

```
/app
  /layout.tsx
  /providers.tsx
  /globals.css                  # Contains @keyframes bento-enter + .bento-tile
  /(auth)
    /sign-in/[[...sign-in]]/page.tsx
    /sign-up/[[...sign-up]]/page.tsx
  /(dashboard)
    /layout.tsx
    /page.tsx                   # Homepage — BentoGrid only (no standalone Hero)
    /calendar/page.tsx
    /trips/page.tsx
    /profile/page.tsx
    /notifications/page.tsx
    /about/page.tsx
  /admin
    /layout.tsx                 # Dead link /admin/los-members removed
    /page.tsx                   # Redirect → /admin/approval-hub
    /approval-hub/page.tsx
    /content/page.tsx
    /operations/page.tsx
    /data-center/page.tsx       # Shows detailed diff after CSV import
    /members/page.tsx
    /members/[id]/page.tsx
  /api
    /profile/route.ts
    /profile/upline/route.ts    # GET own upline name from LOS (2-hop lookup)
    /profile/verify-abo/route.ts
    /trips/[id]/register/route.ts  # Updated: UPDATE if denied, INSERT if new
    ... (all other routes unchanged)
    /admin/los-import/route.ts  # Returns diff: new_members, level_changes, bonus_changes
/components
  /layout
    /Header.tsx                 # UserButton replaced by UserDropdown
    /BottomNav.tsx
    /Footer.tsx                 # flex-wrap on bottom bar (mobile overflow fix)
    /PageContainer.tsx
    /PageHeading.tsx
    /Hero.tsx                   # ⚠️ Superseded — hero now lives inside BentoGrid
    /UserDropdown.tsx           # Custom user menu: initials, role, upline, sign out
  /home
    /BentoGrid.tsx              # 6-tile grid: Hero, Announcements, Nav, Events, Links, Trips
  /trips
    /RegisterButton.tsx         # Self-contained: mutation + spinner + toast
  /calendar
    /CalendarClient.tsx
  /events
    /EventPopup.tsx             # 3-pill roles: HOST, SPEAKER, PRODUCT
  /notifications
    /NotificationPopup.tsx      # (ISS-019 pending)
/lib
  /i18n
    /translations.ts            # EN/BG dictionary + DAYS_I18N + MONTHS_I18N
  /hooks
    /useLanguage.ts             # { lang, toggle, t(key) }
    /useNotifications.ts
/supabase
  /migrations/                  # Created Session 3. All DDL tracked here.
    /20260317000001_fix_trip_notification_url.sql
    /20260317000002_import_los_members_typed_return.sql
/proxy.ts
```

---

## 6. Visual Identity & UX

**Style:** Luxury Modern. Mobile-first.

| Token | Hex | Usage |
|---|---|---|
| Eggshell | `#f4f1de` | Page background, bento tile surfaces |
| Forest | `#2d332a` | Header, nav tile, hero overlay, UserDropdown avatar |
| Deep | `#3d405b` | Primary text, Quick Links tile bg |
| Crimson | `#bc4749` | CTAs, badges, notification dots |
| Sienna | `#e07a5f` | Trips tile bg, active nav, carets, radial accent |
| Stone | `#8e8b82` | Muted text, borders |
| Sage | `#81b29a` | Success, approved |
| Sandy | `#f2cc8f` | Warnings, pending |

### Bento Grid Layout (Homepage)
3-column CSS Grid (`grid-cols-1 md:grid-cols-3`). Desktop layout:
```
[Hero 2×2              ] [Announcements 1×1]
[Hero 2×2              ] [Nav 1×1          ]
[Events 1×1] [Links 1×1] [Trips 1×1        ]
```
Mobile: all tiles full-width, stacked in source order.

### Bento Stagger Animation
Defined in `globals.css` as `@keyframes bento-enter` + `.bento-tile` class. Each tile gets `style={{ animationDelay: 'Xms' }}` inline. Works in Server Components — no JS needed.
- Hero: 0ms → Announcements: 150ms → Nav: 230ms → Events: 300ms → Links: 360ms → Trips: 420ms

### Mobile UX
- `BottomNav`: fixed, Forest bg, hidden `md+`
- `pb-20 md:pb-0` on dashboard main
- `components/layout/Footer.tsx` bottom bar uses `flex-wrap gap-y-1` to prevent overflow at 390px

---

## 7. Auth & Key Patterns

### Clerk
- `afterSignOutUrl="/"` on `ClerkProvider`
- `UserButton` is **replaced** by `components/layout/UserDropdown.tsx`
- Sign out: `useClerk().signOut({ redirectUrl: '/' })`

### Supabase MCP Workflow
1. Always `execute_sql` to read the existing function definition first
2. Use `apply_migration` for all DDL changes
3. Verify with `execute_sql` after applying
4. Commit the SQL file to `supabase/migrations/`

### RPC Return Types
Supabase-js types `jsonb` RPC returns as `unknown`. **Never spread `unknown`.**
```ts
// ✅ Correct
const result = data as { inserted: number; errors: { abo_number: string; error: string }[] }
return Response.json({ inserted: result.inserted, errors: result.errors, ...extra })

// ❌ Wrong
return Response.json({ ...data, ...extra })  // TypeScript error: spread of unknown
```

---

## 8. Core Module Logic

### 8.1 LOS Hierarchy & Data Sync
- **Import RPC:** `import_los_members(rows jsonb)` — returns `{ inserted, errors }`
- **Diff computed in route:** snapshot `los_members` before RPC call → compare incoming rows → return `{ inserted, errors, diff: { new_members, level_changes, bonus_changes } }`
- **Bonus change threshold:** ≥3% shift in `bonus_percent`
- **Path rebuild:** `rebuild_tree_paths()` called after every import

### 8.2 Trip Registration Flow
- Register route does `maybeSingle()` check before INSERT:
  - `denied` → `UPDATE status = 'pending'` (audit trail preserved, returns 200)
  - `pending` / `approved` → 409 "Already registered"
  - No existing record → `INSERT` (returns 201)
- `RegisterButton` component manages its own mutation, spinner (`animate-spin`), and 3.5s toast

### 8.3 Event Role Requests
- 3 fixed role pills: `['HOST', 'SPEAKER', 'PRODUCT']`
- Click → immediate `POST /api/events/[id]/request-role` with `{ role_label }`
- Active pending pill shows ✕ to cancel. Active approved shows ✓. Others disabled while one is active.
- No form expansion, no note field.

### 8.4 Notifications
- Bell icon in Header links to `/notifications` page
- `NotificationPopup` (ISS-019 pending): bell opens scrollable dropdown, "View all" → `/notifications`
- Trip notification `action_url` corrected to `/trips` (was `/trips/{id}` → 404)

### 8.5 User Dropdown (`UserDropdown.tsx`)
- Replaces Clerk `UserButton`
- Shows: initials avatar, full name, role badge, upline name (from `/api/profile/upline`)
- Upline lookup: `profile.abo_number` → `los_members.sponsor_abo_number` → `los_members.name`
- Admin link shown conditionally. Closes on outside click / Escape.

### 8.6 i18n (EN/BG)
- `lib/i18n/translations.ts` — 70+ keys, `DAYS_I18N`, `MONTHS_I18N` arrays
- `useLanguage()` returns `{ lang, toggle, t(key) }`
- Client Components use `t()`. Server Components SSR in EN (correct — `useState('en')` matches server render, no hydration mismatch).
- Admin pages: English only.

---

## 9. Known Decisions & Gotchas

| Topic | Decision |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| `cookies()` | Must be `await`ed in Next.js 16 |
| `<Image fill>` | Parent needs explicit `height: Npx` — `minHeight` does NOT establish a containing block for fill images. Use `absolute inset-0` for content overlay. |
| `React.ReactNode` type | Requires `import React` explicitly in Next.js 16, even though JSX transform doesn't need it for JSX itself |
| Tailwind v4 | `@layer components` with `@apply` unsupported — inline all utility classes in JSX |
| Server Component event handlers | `onMouseOver`/`onError` etc. cause prerender failure — use CSS classes |
| Bento animation | Pure CSS `@keyframes` in `globals.css` + `.bento-tile` + inline `animationDelay`. Works in Server Components. |
| Supabase RPC jsonb | Typed as `unknown` — cast to known shape explicitly, never spread |
| Re-registration | `maybeSingle()` before INSERT in register route. UPDATE if denied. |
| `components/layout/Hero.tsx` | Superseded by hero tile inside `BentoGrid.tsx`. Can be deleted. |
| `supabase/migrations/` | Created this session. All DDL goes here. Apply via Supabase MCP, commit SQL file. |
| Admin nav | `/admin/los-members` dead link removed. LOS data is in `/admin/members`. |
| Footer mobile overflow | Bottom bar uses `flex-wrap gap-y-1` — two copyright strings exceed 358px at 390px |
| EUR currency | DB `CHECK` constraint — enforced at DB level, not just UI |
| `sub` JWT claim | Use `user_id` instead — `sub` is reserved |
| `afterSignOutUrl` | Set on `ClerkProvider`, not `UserButton` (removed in Clerk v6) |
| Admin RLS bypass | Explicit `is_admin()` check — never rely on `abo_number = null` NULL handling |

---

## 10. Session 3 Summary (2026-03-17)

### Issues Completed
ISS-004 (Mobile QA), ISS-003 (About page content), ISS-009 (Nav audit + /admin 404 fix), ISS-010 (i18n EN/BG), ISS-011 (UserDropdown), ISS-012 (LOS diff), ISS-013 (pending), ISS-014 (trip notification 404), ISS-015 (Bento homepage v1), ISS-016 (RegisterButton), ISS-017 (re-registration after denial), ISS-018 (3-pill event roles), ISS-019 (pending), ISS-021 (pending), ISS-022 (Hero pill), ISS-023 (Full bento overhaul)

### Key Architecture Changes
- Homepage fully rebuilt as 6-tile Bento Grid with staggered CSS animation
- Clerk UserButton replaced by custom UserDropdown with LOS upline data
- Event role system simplified to 3 fixed pills (HOST/SPEAKER/PRODUCT)
- LOS import now returns a detailed diff (new members, level changes, bonus changes)
- Trip re-registration after denial now works (UPDATE instead of INSERT)
- `supabase/migrations/` folder established for DDL tracking
- i18n system built: 70+ EN/BG translation keys across all client components
