# CLAUDE.md — teamenjoyVD Portal
> Last updated: 2026-03-20 — Merged optimal structure. Latest stable commit: c75518d. Clerk audit complete (@7, no JWT template, service role pattern confirmed).

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

## PIU — Pack It Up

When the user types **PIU**, execute this sequence:
1. Update CLAUDE.md header with current session state (new stable commit, pending issues, gotchas discovered this session).
2. Verify `git status` is clean and latest commit is pushed.
3. Confirm new session can start with just: repo URL + PAT + "SSU".

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.1.6 App Router + React 19 | Turbopack enabled |
| Auth | Clerk @7 | `clerkMiddleware` + `createRouteMatcher` in `proxy.ts`. Route handlers: `await auth()` → `{ userId }`. No Clerk JWT template — auth enforced at API layer via service role client. `UserButton` replaced by custom `UserDropdown`. |
| Database | Supabase (PostgreSQL 17) | RLS on all tables. LTree (ltree extension), pg_cron, pg_net. Project: `ynykjpnetfwqzdnsgkkg` (eu-west-1). |
| State | TanStack Query v5 | `QueryClientProvider` in `app/providers.tsx`. |
| Styling | Tailwind CSS v4 | No `@layer components` + `@apply`. Inline utilities only. Exception: `globals.css` and `styles/brand-tokens.css`. |
| Fonts | Cormorant Garamond + DM Sans | `font-display` = Cormorant Garamond, `font-body` = DM Sans. CSS vars: `--font-cormorant`, `--font-dm-sans`. |
| Maps | Mapbox GL JS v2.15.0 | CDN only — never import as npm (SSR breaks). Token: `NEXT_PUBLIC_MAPBOX_TOKEN`. Fallback static tile if token missing. |
| iCal | jose + ical-generator | `/api/calendar/feed.ics?token=<jwt>`. Secret: `ICAL_TOKEN_SECRET`. |
| Middleware | `proxy.ts` | NEVER create `middleware.ts`. |
| Deployment | Vercel | Team: `teamenjoyvd`. Project ID: `prj_HFZJZg2vkLtpX8XvjJlo3mDkSCyn`. |
| Repo | `https://github.com/teamenjoyvd/tevd-portal.git` | Private, `main` branch only. |
| Production | `https://tevd-portal.vercel.app` | |

---

## 2. Hard Constraints

These are non-negotiable. Violation = immediate stop.

- **NEVER create `middleware.ts`.** This project uses `proxy.ts`. If asked — refuse, then ask what problem is actually being solved.
- **NEVER bypass Clerk auth on a protected route.** If a ticket requests it — refuse immediately. It is a security violation.
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** Server-only. No exceptions.
- **NEVER write `Status=Done` to Airtable before the commit link exists.** Finalization is atomic.
- **NEVER proceed past CLAIM if `Blocked By` is non-empty** without explicit human acknowledgment.

### ⚠️ DESKTOP / MOBILE LAYOUT LAW

**This project has two separate, complete, perfectly functional layouts that share a database. There is NO hybrid responsive design. NO shared adaptive components.**

The pattern is always:
```tsx
{/* Desktop */}
<div className="hidden md:block">
  {/* Full desktop layout */}
</div>

{/* Mobile */}
<div className="md:hidden">
  {/* Full mobile layout */}
</div>
```

**ABSOLUTE PROHIBITIONS — violation = immediate revert:**
- NEVER implement a `BottomNav`, tab bar, floating action button, or any mobile-specific navigation chrome without explicit written sign-off in the ticket.
- NEVER use `overflow-x-auto` on navigation elements — if content overflows, the layout is wrong.
- NEVER create components that try to be "responsive" by hiding/showing parts of themselves. Desktop = one component. Mobile = a separate component or block.
- NEVER add mobile padding offsets (`pb-20`, `mb-safe`, etc.) to accommodate navigation chrome that wasn't explicitly requested.
- NEVER ship a mobile UI pattern (bottom sheet nav, swipe gesture, sticky tab bar) that wasn't in the ticket's DoD.

**The About page (`app/(dashboard)/about/page.tsx`) is the canonical reference** for the correct dual-layout pattern. Read it before implementing any new page.

---

## 3. Architecture Rules

### Server / Client Boundary
- Default to RSC. Add `"use client"` only when the component requires: `useState`/`useReducer`, `useEffect`, browser APIs, or event handlers that cannot be server actions.
- Do not add `"use client"` pre-emptively.
- `cookies()` and `headers()` are async in Next.js 16 — always `await` them.

### Data Fetching
- Fetch in RSC wherever possible. Pass data down as props.
- Do not fetch in client components unless real-time or user-triggered.
- No `fetch()` calls with hardcoded `localhost` URLs.
- Revalidation via `revalidatePath` / `revalidateTag` — not full page reload.

### Auth Pattern
- Route handlers: `const { userId } = await auth()` — return 401 if null.
- All authenticated DB queries use `createServiceClient()` (service role). RLS enforced at API layer, not Supabase JWT layer.
- Do NOT introduce a Clerk JWT Supabase client without a ticket explicitly scoping it.

### Database
- All schema changes via numbered migration files in `/supabase/migrations/`.
- Never run raw `ALTER TABLE` in application code.
- RLS must be enabled on every user-facing table. No exceptions.
- Never disable RLS to "fix" a permissions issue — fix the policy.
- Regenerate `types/supabase.ts` after every migration.

### Routing
- App Router conventions: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`.
- Dynamic segments use `[param]` folders.
- Route handlers live in `app/api/**/route.ts`.
- No legacy `getServerSideProps` / `getStaticProps` anywhere.

---

## 4. Regional Standards (EET/EEST)

- Dates: `DD.MM.YYYY`
- Time: 24-hour (`14:30`, not `2:30 PM`)
- Currency: EUR, formatted as `1.234,56 €`
- Numbers: period as thousands separator, comma as decimal
- First day of week: Monday
- **Always use `lib/format.ts` helpers. Never inline `toLocaleDateString` or `Intl` calls.**

---

## 5. i18n

- All user-facing strings go through `t()` from `next-intl`.
- Supported locales: `en`, `bg`.
- Translation files: `/messages/en.json` and `/messages/bg.json`.
- Never hardcode a user-facing string in a component.
- Cyrillic nav labels: no uppercase transform, reduced letter-spacing.

---

## 6. Code Style

### Zero-Refactor Rule
When editing a file, change only the lines required to satisfy the task. Never re-indent, reformat, rename variables, or modernize syntax in untouched sections — even if the existing style is inconsistent or poor.

### General
- No default exports from utility files — named exports only.
- No barrel `index.ts` files unless one already exists in that directory.
- No `console.log` in committed code — use structured error returns.
- Prefer explicit return types on all server actions and API route handlers.
- No `any` — use `unknown` and narrow, or define the type.
- Use `<img>` for user-uploaded images (trip `image_url`, Meta CDN) — domains are unpredictable.
- `npx tsc --noEmit` must pass with zero errors before every commit.

---

## 7. Workflow Loop — Airtable → GitHub

Every code change is anchored to an Airtable issue. No exceptions.

Declare current phase at the opening of every work response:
`PHASE: READ | CLAIM | GATHER | EXECUTE | VERIFY | FINALIZE`

**PHASE: READ**
1. Query Issues where `Status = "In Progress"`. If one exists, resume — skip to GATHER.
2. If none, query Issues where `Status = "To Do"` AND `Blocked By` is empty, sorted by Priority ascending.
3. If the top ticket is vague, over-scoped, contradictory, or potentially harmful — do not claim it. Surface the problem via targeted questions.
4. If the queue is empty: list blocked tickets with their blockers, list Needs Design tickets, state queue is empty. Ask a single routing question.

**PHASE: CLAIM**
5. Update `Status → "In Progress"`. Gate: `Blocked By` must be empty. If not — refuse and ask why the blocker is being ignored.

**PHASE: GATHER**
6. Read `CLAUDE.md` from repo root. If missing, outdated, or contradicts current best practice — stop and flag the specific contradiction. Do not silently comply.
7. Read `Target Files` and `Definition of Done` from the Airtable record.
8. If the DoD is vague, incomplete, or contradicts `CLAUDE.md` — probe before writing any code. A DoD that cannot be verified is not a DoD.

**PHASE: EXECUTE**
9. Write the code.
10. Zero-Refactor Rule: change only the lines required by the DoD.

**PHASE: VERIFY**
11. Open a thinking block. Go through the DoD point by point and confirm each item is satisfied.
12. Ask: Does this actually prevent the failure mode we claimed to address? What edge case is still untested? Have we introduced debt not in the ticket?
13. If any gap remains — iterate. Do not proceed to FINALIZE.

**PHASE: FINALIZE**
14. Commit and push. Format: `[ISS-XXXX] Short imperative description`.
15. Single Airtable write: `Status=Done` + `CommitLink` + `ClaudeNotes`. Do not write `Status=Done` before the commit link exists.
16. `ClaudeNotes` must include: what was done, assumptions questioned and resolved, remaining risks or debt, honest DoD assessment, open questions for future validation.

### Airtable Reference

**Base ID:** `app1n7KYX8i8xSiB7` — **Issues Table:** `tblUq45Wo3xngSf3w`

#### Field IDs
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

#### Status Choice IDs
| Status | Choice ID |
|---|---|
| To Do | `selO8Bg7VWY6E9sxB` |
| In Progress | `sel4MPU6wsEW7uclv` |
| Done | `selRTL4WT8qro1TnL` |
| Not relevant | `sellrX5il5BmfBxm9` |
| Needs Design | `sel98265UTlgLcw5r` |
| Blocked | `sellZeVnRByP94606` |

---

## 8. Environment Variables (Vercel)

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

## 9. Design System — 2026 Bento

All tokens defined in `styles/brand-tokens.css`.

### Brand Palette
| Token | Value | Usage |
|---|---|---|
| `--brand-forest` | `#2d332a` | Dark green — hero, nav, map tile bg, footer bg |
| `--brand-crimson` | `#bc4749` | Red — CTAs, eyebrow labels, notification dots |
| `--brand-teal` | `#3E7785` | Blue-green — links tile, sign-in button |
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

### BentoCard Variants
| Variant | Class | Use |
|---|---|---|
| `default` | `.card` | Standard card |
| `forest` | `.card.card--forest` | Dark green — hero, map |
| `crimson` | `.card.card--crimson` | Red — trips tile |
| `teal` | `.card.card--teal` | Teal — quick links |
| `edge-info` | `.card.card--edge-info` | Left teal border |
| `edge-alert` | `.card.card--edge-alert` | Left crimson border |

### Eyebrow Component
- Default color: `var(--brand-crimson)`
- Pass `style={{ color: 'var(--brand-parchment)' }}` on teal/forest tiles
- Tracking: `0.25em`, Weight: `font-semibold`

### BentoGrid
- `grid-template-columns: repeat(12, 1fr)` + `gap: 12px` + `auto-rows: minmax(120px, auto)`
- Outer wrapper: `max-w-[1440px] mx-auto px-4 sm:px-8 xl:px-12 2xl:px-16`
- Mobile: `.bento-mobile-full` = `grid-column: 1/-1 !important`, `.bento-mobile-half` = `span 6 !important`
- **Client tile gotcha:** Tile components MUST accept `rowSpan` prop and apply it — otherwise the CSS grid collapses.

---

## 10. Homepage Layout (current)

12-col, 4-row bento grid. All tiles `rowSpan={2}`.

```
ROW 1: Hero(col-6,forest) | Profile(col-2,default) | Events(col-4,default)*
ROW 2: Trips(col-3,crimson)* | Announcements(col-6,default)* | Links(col-3,teal)*
ROW 3: Socials(col-4,default) | Theme(col-2,default) | Map(col-3,forest) | About Us(col-3,default)
ROW 4: Guides(col-12,default)
```

**Events tile:** Each row = left (name + event_type pill) + right (iOS date square crimson + 24h time). No week number badge.
**\* = conditionally rendered — return null when empty. Grid auto-fills.**

---

## 11. Navigation

### Header (`components/layout/Header.tsx`)
- Public routes: `/`, `/about`, `/calendar`, `/trips`
- Auth-only: `/profile`, `/notifications`, `/los`, `/guides`, `/admin`
- Mobile hamburger: `md:hidden` button, slide-down drawer, outside-click + Escape dismissal
- Nav casing: `tracking-widest uppercase` unconditionally for all languages

### Footer (`components/layout/Footer.tsx`)
- Logo: `filter: brightness(0) invert(1)` — white on forest bg
- Nav: `hidden md:flex flex-nowrap` — hidden on mobile, single row on md+
- Nav order: Home → About → Calendar → Trips → Guides → My Network
- 3-col: brand | nav | socials (IG, FB, email icons)
- **NO BottomNav. NO mobile tab bar. Mobile nav = Header hamburger only.**

---

## 12. Key Files & Patterns

### `lib/format.ts`
EET/EEST regional formatting. **Always import from here — never inline `toLocaleDateString`.**
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

### `lib/supabase/service.ts`
Singleton service role client. Do not create a new client per request. All authenticated server queries go through here.

### `components/about/AboutMapTile.tsx`
Client Mapbox tile. Accepts `gridColumn`, `className`, `style` props. Theme-aware (light-v11/dark-v11), MutationObserver for theme swap.

### `components/events/EventPopup.tsx`
- **Mobile (<768px):** Fixed bottom sheet — backdrop + `rounded-t-2xl`, `85dvh` max, drag handle
- **Desktop:** Anchor-relative popover, clamped to viewport on all sides

### `components/bento/tiles/LocationTile.tsx`
- Theme-aware via MutationObserver
- `border: none` override on BentoCard (ISS-0121)

### About Page (`app/(dashboard)/about/page.tsx`) — CANONICAL DUAL LAYOUT REFERENCE
Option B: `hidden md:block` desktop grid + `md:hidden` mobile stack.

---

## 13. Directory Structure

```
/app
  /(dashboard)
    /page.tsx                    # Homepage — 12-col BentoGrid server component
    /about/page.tsx              # CANONICAL dual-layout reference
    /trips/page.tsx
    /profile/page.tsx            # Multi-bento layout
  /admin
    /approval-hub/page.tsx       # ABO + manual verification review
    /calendar/page.tsx           # ascending: true (soonest first)
    /data-center/page.tsx        # LOS import + reconciliation panel
    /notifications/page.tsx
    /operations/page.tsx         # Trips CRUD + payment log + submission review
  /api
    /admin/calendar/route.ts
    /admin/payments/route.ts
    /admin/payments/[id]/route.ts
    /admin/verify/route.ts
    /profile/payments/route.ts
    /profile/route.ts
    /profile/verify-abo/route.ts
    /profile/vitals/route.ts
    /profile/event-roles/route.ts
    /profile/los-summary/route.ts
    /profile/upline/route.ts
    /webhooks/clerk/route.ts
/components
  /about/AboutMapTile.tsx
  /bento
    /BentoCard.tsx
    /BentoGrid.tsx
    /tiles/LocationTile.tsx
  /events/EventPopup.tsx
  /layout
    /Footer.tsx
    /Header.tsx
    /BottomNav.tsx               # DEAD STUB — do not import
/lib
  /format.ts                     # EET helpers (always use this)
  /supabase
    /client.ts                   # Browser client (anon key)
    /server.ts                   # Server client (anon key + cookies)
    /service.ts                  # Service role singleton
  /i18n/translations.ts
/styles
  /brand-tokens.css
/docs
  /ai
    /system-prompt.xml
```

---

## 14. Database Schema (key tables)

### `notifications`
`id, profile_id, is_read, type (enum), title, message, action_url, created_at, deleted_at`
- Soft-delete: `deleted_at IS NULL` on user queries. Admin audit log sees all.

### `calendar_events`
`id, google_event_id, title, description, start_time, end_time, category, visibility_roles, week_number, event_type, created_at, created_by`

### `profiles`
`id, clerk_id, first_name, last_name, display_names, role, abo_number, upline_abo_number, document_active_type, id_number, passport_number, valid_through, ical_token, phone, contact_email, created_at`
- `role` DB default: `'guest'`
- `upline_abo_number` — stores soft upline ref for manually-verified no-ABO members (ISS-0139)

### `abo_verification_requests`
`id, profile_id, claimed_abo, claimed_upline_abo, request_type, status, admin_note, created_at, resolved_at`
- `request_type`: `'standard'` | `'manual'` (ISS-0139)

### `trip_payments`
`id, trip_id, profile_id, amount, transaction_date, status, note, proof_url, payment_method, submitted_by_member, created_at`
- Members INSERT with `submitted_by_member=true, status='pending'` only (RLS)
- Admin/Core approve/deny via PATCH `/api/admin/payments/[id]`

### `tree_nodes`
`id, profile_id, parent_id, path (ltree), depth, created_at`
- No-ABO members: `p_<uuid_no_hyphens>` label, direct child of upline (ISS-0139)
- On ABO assignment: label renamed, `rebuild_tree_paths` called

---

## 15. Access Control

Role hierarchy: `admin > core > member > guest`

Public (no auth): `/`, `/about`, `/calendar`, `/trips`
Auth required: all other routes

### Registration & Verification Flows

**Path A — Standard ABO:**
Guest submits `claimed_abo` + `claimed_upline_abo` → admin approves → `role='member'`, `abo_number` set, normal tree placement.

**Path B — Manual, no ABO, user-initiated (PENDING ISS-0140/0141):**
Guest submits only `claimed_upline_abo` + selects "I don't have an ABO number" → `request_type='manual'` → admin approves → `role='member'`, `abo_number=NULL`, placed as `p_<uuid>` child of upline.

**Path C — Admin-initiated manual (PENDING ISS-0140/0142):**
Admin picks guest, provides upline ABO → directly promotes to member.

**No-ABO member constraints:**
- Cannot have downlines (LOS import is source of truth)
- Full portal access otherwise
- LOS import always wins for tree positioning

---

## 16. LOS Tree & Notifications

- `notify_role_request`: admins + Core ancestors of requester
- `notify_trip_created`: all member/core/admin
- `notify_calendar_event_created`: Core-created → fan-down descendants + fan-up Core ancestors
- `run_los_digest`: pg_cron daily 06:00 UTC
- `get_core_ancestors(uuid)`: ltree query on tree_nodes → Core profile UUIDs

---

## 17. Calendar

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

## 18. Admin

### Calendar (`admin/calendar`)
- Events ordered ascending by `start_time` (soonest first) — ISS-0123

### Operations (`admin/operations`)
Trips CRUD + milestones + admin payment log + member payment submission review.

### Approval Hub (`admin/approval-hub`)
Standard ABO requests + manual requests (separate section) + Path C direct-verify form. ISS-0142 pending.

### Data Center (`admin/data-center`)
LOS import + reconciliation panel for matching unrecognized LOS members to no-ABO profiles. ISS-0143 pending.

### Notifications Audit Log
All-time, including soft-deleted. Paginated 50/page.

---

## 19. Gotchas & Decisions

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| `cookies()` | Must be `await`ed in Next.js 16. |
| Tailwind v4 | No `@layer components` + `@apply`. Inline utilities only. |
| Mapbox GL JS | CDN only. Dupe guard on script load. Logo/attrib hidden via globals.css. |
| Mapbox theme swap | `map.setStyle()` + listen for `styledata` event. MutationObserver on `data-theme`. |
| Client tiles + rowSpan | Must apply `gridRow: span N` to outermost element or grid collapses. |
| Nav casing | `tracking-widest uppercase` for ALL languages including BG. |
| Eyebrow on teal/forest | Pass `style={{ color: 'var(--brand-parchment)' }}` to override default crimson. |
| Soft-delete notifications | `deleted_at IS NULL` on all user-facing queries. Admin sees all. |
| Clerk appearance | CSS vars NOT available in Clerk shadow DOM. Use hardcoded hex (`#bc4749`). |
| Clerk v7 auth | `await auth()` → `{ userId }`. No sync auth(). No JWT template. Service role client handles all DB queries. |
| Supabase auth pattern | RLS is NOT enforced via Clerk JWT. Auth gate = `await auth()` at route handler. Do not introduce Clerk JWT Supabase client without a ticket. |
| useLanguage | Dispatches `window.dispatchEvent(new Event('language-changed'))` on toggle. |
| Homepage empty tiles | Events/Trips/Announcements/Links render null when empty. Grid auto-fills. |
| Date/time formatting | ALWAYS use `lib/format.ts`. Never inline `toLocaleDateString`. EET = bg-BG locale, 24h, DD.MM.YYYY. |
| Currency formatting | `formatCurrency()` → `1.234,00 €` (de-DE Intl). |
| LocationTile border | Overridden with `style={{ border: 'none' }}` on BentoCard. |
| EventPopup mobile | Bottom sheet pattern (`fixed bottom-0`, `85dvh`, backdrop). NOT anchor-relative on mobile. |
| About page layout | Option B: `hidden md:block` desktop + `md:hidden` mobile. CANONICAL REFERENCE. |
| Admin calendar order | `ascending: true` in `/api/admin/calendar` GET. |
| `types/supabase.ts` | Regenerate after EVERY migration. |
| `<img>` vs `next/image` | Use `<img>` for user-uploaded images — domains unpredictable. |
| Admin link in ProfileTile | `role === 'admin'` only. |
| `style2` prop | NEVER USE. Merge into a single `style` object. |
| Profile page guard | Use `profile?.id` check, not `!profile` — error responses are truthy objects. |
| LOSBox array guard | Always `Array.isArray()` before passing API response to `buildSubtree`. |
| Supabase service client | Singleton in `lib/supabase/service.ts` — do not create new client per request. |
| New user role | Clerk webhook defaults to `role: 'guest'`. Never change to member without admin approval. |
| BottomNav | REMOVED (ISS-0137). `BottomNav.tsx` is a dead stub. Do NOT re-add or re-import. |
| Footer nav mobile | `hidden md:flex` — hidden on mobile. Header hamburger is the only mobile nav. |
| Mobile nav chrome | NO bottom nav bars, NO tab bars, NO floating nav unless explicitly in ticket DoD. |
| `overflow-x-auto` on nav | NEVER. Fix the layout. |
| No-ABO tree node label | `p_<profile_uuid_no_hyphens>` — renamed to real ABO label on assignment. See ISS-0139. |
| LOS import is source of truth | LOS company import always wins for tree positioning. |

---

## 20. Releases

| Version | Date | Status | Notes |
|---|---|---|---|
| v1.0.0 | 2026-03-01 | Shipped | Core Auth & LOS |
| v1.2.0 | 2026-03-16 | Shipped | Calendar rewrite, approval hub, member profiles |
| v1.3.0 | 2026-03-18 | Shipped | Admin CRUD, QA fixes, LOS views, Core notifications, bento polish |
| v1.4.0 | 2026-03-18 | Shipped | About page, mobile overhaul, QA batch, EET formatting, lib/format.ts |
| v1.4.1 | 2026-03-19 | Shipped | Profile crash guard, webhook guest default, service client singleton, SSU |
| v1.5.0 | 2026-03-19 | Shipped | Profile overhaul (ISS-0128–0138), footer/BottomNav fixes, verification paths |

Latest stable commit: `c75518d`

---

## 21. Pending Issues

| ID | Name | Priority | Status | Notes |
|---|---|---|---|---|
| ISS-0056 | Meta token expiry alert + refresh flow | Low | Blocked | Needs `FB_APP_ID` + `FB_APP_SECRET` in Vercel |
| ISS-0125 | Design revisit: inner pages mobile layout | P2 | Needs Design | /calendar, /trips, /guides, /profile |
| ISS-0139 | DB migration: verification paths + upsert_tree_node NULL-ABO | P1 | To Do | Foundation for ISS-0140–0143 |
| ISS-0140 | API: verify-abo Path B + Path C routes | P1 | To Do | Blocked by ISS-0139 |
| ISS-0141 | Profile page: Path B manual verification UI | P2 | To Do | Blocked by ISS-0140 |
| ISS-0142 | Admin approval hub: manual queue + Path C direct-verify | P2 | To Do | Blocked by ISS-0140 |
| ISS-0143 | LOS import: reconciliation panel for no-ABO profiles | P2 | To Do | Blocked by ISS-0139 |

---

## 22. Supabase MCP Workflow

1. Read existing function/table first with `execute_sql`
2. DDL changes → `apply_migration` (never raw `execute_sql` for DDL)
3. Verify with `execute_sql` after
4. Save SQL to `supabase/migrations/YYYYMMDDNNNNNN_name.sql`
5. Run `generate_typescript_types` → write to `types/supabase.ts`
6. `npx tsc --noEmit` → zero errors → commit

### RLS Pattern
```sql
(auth.jwt() ->> 'user_role') IN ('admin', 'core')
profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
```

---

## 23. When This File Is Wrong

If any instruction here contradicts Next.js 16 / Clerk v7 / Supabase current SDK behavior — stop and flag it. Do not silently comply with an outdated instruction. State the contradiction, cite the correct current behavior, and ask for a decision before proceeding.
