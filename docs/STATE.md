## Goal
**#751** (`dev/2608-DEV-751`, cut from `main` @ `b6b856a`): the two observability defects found while
diagnosing #749 in production — `fetchJson` dropping the route's `code` (so the admin approval hub
showed one hardcoded English toast for every failure), and both role routes swallowing the driver
error on their DB-error branches. **Migration: no.**

## Now

BUILD complete and locally verified (`7a57f8b`); next action is the draft PR. Not pushed — no push
grant exists in this conversation.

**Production cancel/revoke was broken for a reason that is NOT a code defect.** PR #750 merged
2026-08-16 21:54 and Vercel shipped the code, but the gated `Migrate Prod` run
[31974848811](https://github.com/teamenjoyvd/tevd-portal/actions/runs/31974848811) is still
`waiting` at the `Production` environment approval. Verified against `ynykjpnetfwqzdnsgkkg`:
`registration_status` = pending/approved/denied only, no `cancelled`; `event_role_requests` has
neither `cancelled_at` nor `cancelled_by`; ledger head is still `20260811000100`. So every
cancel/revoke write 400s (`PGRST204`) while role SIGN-UP still works, because the insert touches
none of the new schema. **Approving that run is the fix; #751 changes nothing about it.**
The same UPDATE was probed against DEV in a rollback-only `DO` block and succeeded
(`rows_updated_id=331af8ff… status=cancelled`), confirming the code path itself is sound.

### #749 — what landed (merged as PR #750)

**Migrations are already applied to DEV `iymwxdewcpvpjgzewtzk`** (user approved this session).
The Supabase MCP recorded HHMMSS-style ledger versions (`20260816203117` / `...203152`); both rows
were **rewritten in place** to `20260816000000` / `20260816000100` so the ledger matches the repo
filenames. Verified on DEV: `enum_range(registration_status)` = approved/cancelled/denied/pending,
both `cancelled_*` columns present, both functions recompiled with the new bodies.

`types/supabase.ts` was **NOT** taken wholesale from the MCP generator — it emits `public` only and
would have deleted the `graphql_public` and `storage` schemas (485 lines). The four generator-
produced deltas were spliced into the committed file instead (22 insertions, 2 modified lines).

**The issue body was wrong on one point.** It said to copy `notify_role_request_status_change()`
from `baseline.sql:785`. That is not the live definition — `20260705000800:261` retargeted the
insert from `public.notifications` to `public.member_notifications`. Copying the baseline body would
have silently reverted that. The migration copies the 20260705000800 version.

**The issue's "must be checked at BUILD" question is answered: no duplicate reminders.**
`fn_schedule_guest_reminders_record` (`20260705000800:53-75`) upserts
`ON CONFLICT (registration_id, type) DO UPDATE`, and re-approval reuses the same
`guest_registrations.id`. Nothing to fix.

### #743 — what landed (merged as PR #748)

`app/(dashboard)/components/tiles/SocialsTile.test.tsx` is the **repo's first component test suite**
— 13 cases over the six seeded data shapes. Infra: `jsdom` + `@testing-library/react` (+ the
`@testing-library/dom` peer, which RTL v16 does not bundle) as dev deps, `.tsx` added to the vitest
include globs. Default environment stays `node`; component files opt into jsdom with a
`// @vitest-environment jsdom` docblock. `tsconfig.json` already sets `jsx: react-jsx`, so esbuild
transforms `.tsx` with no React plugin.

### #740 — what landed (merged)
Commits `9fc24a9` (original) + the radius revision on top.

A1 event-bar wrapper carries a 2px inset keyed off `packWeek`'s `continuesLeft/Right`. A2 the popup
title is a real `DialogTitle` at `text-lg` (the Dialog had no accessible name at all). A3
`popup/styles.ts`, `EVENT_TYPE_STYLES` and the popup's pills/rows/skeletons all resolve to
`--status-*` pairs. A5 the Trips tile body links to `/trips/{id}` via a sibling overlay — the
issue's `z-0` spec would NOT have worked (content overlays are `z-10` and not click-transparent), so
content is `pointer-events-none` and the pill sits at `z-20`.

**A4 was redesigned mid-session after visual review.** It originally collapsed everything to one
16px radius. That failed because **CSS clamps corner radii**: the rendered corner is
`min(r, width/2, height/2)`, so a 19px status badge is a capsule at 16px *and* at 12px. A single
value cannot serve a 200px card and a 19px badge. Now:

| Tier | Value | Token | Utility |
|---|---|---|---|
| Container | 8px | `--radius` | `rounded-container` |
| Control | 4px | `--radius-control` | `rounded-control` |

`--radius-sm` is 2px (hairline). `--radius-md/lg/xl` are pinned to the control tier and
`--radius-2xl` to the container tier as a **legacy landing zone**, so unmigrated code lands sanely —
that is not a scale, and new code must use the named utilities.

### #741 C1 — what landed
Commits `09b4280` + `bc60cf2` on `dev/2608-DEV-741`.

`--link`, `--link-hover`, `--on-accent`, `--overlay`, `--hover-surface`, `--focus-ring` in both
themes; `@theme inline` maps every semantic token into Tailwind's colour scale; `color-scheme` set
for both themes; `@custom-variant dark` registered against `[data-theme="dark"]`, reversing the old
blanket ban with the doc updated in the same commit.

## Next
1. **Approve the pending `Migrate Prod` run 31974848811** (Actions → `Production` gate). This is
   what actually restores cancel/revoke in production; it is independent of #751. Both migration
   files are idempotent (`ADD VALUE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), so a re-run is safe.
   Smoke-check `https://www.teamenjoyvd.com` afterwards.
2. Push `dev/2608-DEV-751`, open the PR as a DRAFT, wait for CI green + Vercel preview READY, then
   mark it ready for review (one CodeRabbit pass).
3. `npm run verify` deliberately NOT run locally: its `next build` runs under `NODE_ENV=production`,
   which on this box resolves `.env.local` = PROD. CI builds it on the PR.
3. **DEV cleanup pending from #743** (carried, not done in this ticket): `social_posts` holds 6
   seeded variants (`post_url like '%dev-seed-743-variant-%'`) plus three objects in the DEV
   `social-thumbnails` bucket (`dev-seed-743.jpg`, `-pale.png`, `-alt.png`). DEV `social_posts` was
   empty before that ticket, so deleting every row is correct. #743 also still needs closing.

## Constraints
- Never push without an explicit grant in this conversation. Grants from earlier tickets/sessions do
  not carry over. (A grant WAS given this session: "PUSH TO OPEN DRAFT PR #740 and #741".)
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the DEV stack.
  Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#740): corner radius is **two tiers at 2:1** — containers 8px, controls 4px. Chosen so
  that **nothing clamps anywhere** (both sit below half the height of the shortest element in their
  tier) and so a badge reads as nested inside its card. If either changes, keep the ratio and keep
  the control value under half the shortest badge's height.
- DECISION (#740): the authoring API is the **named** utilities `rounded-container` /
  `rounded-control`, not the built-in steps. A bare `rounded-xl` never encoded which KIND of element
  it was on, which is exactly how four scales drifted into the codebase.
- DECISION (#740): sheets and the mobile dialog follow the container tier — no exception. Footer
  social icon buttons square up to the control tier. `--radius-sm` = 2px stays a distinct step.
- DECISION (#740): the radius migration is **phased**. Phase 1 (this PR) covers `components/`,
  `app/(dashboard)/`, `app/events/`. Phase 2 covers `app/admin/**`.
- DECISION (#734): `gotoProtected` covers protected PAGE navigations only. Two spec shapes have no
  protected page to land on — API-only (`los-submission-auth`, and `admin-auth`'s `page.request`
  cases) and PUBLIC target pages (`/events/:id/join`, `/events/:id/register`). Both got
  `waitForServerSession()` in `e2e/auth-helpers.ts`.

## Facts
- **CSS clamps corner radii** (CSS Backgrounds 3 §5.5): rendered corner is
  `min(r, width/2, height/2)`. Measured element heights — status badge **19px**, Trips eyebrow
  21.5px, filter chip 24px, Footer social button 32px, navbar 56px. This is why 12px would have
  changed nothing for the pills.
- `docs/design/radius-bench.html` is a standalone browser tool that renders every portal surface at
  an adjustable radius, both themes, and reports requested vs actually-rendered radius. Open it
  before touching either radius value. Its specimen palettes are copied from `brand-tokens.css` and
  must be updated by hand if those tokens change.
- Tailwind v4.2.1: a `@theme` override of a BUILT-IN scale key works, and **custom** `@theme` keys
  generate named utilities including directional variants (`rounded-t-container`,
  `md:rounded-container`). Verified by compiling the real `app/globals.css` through `tailwindcss`'s
  `compile()`; that harness lived in the session scratchpad, not the repo.
- Plain `@theme { --color-x: var(--y) }` does **NOT** freeze the light value — it emits an
  indirection CSS still substitutes at use-time, so it is theme-aware too. `@theme inline` is
  preferred for being the shadcn v4 convention and dropping the indirection, NOT because plain
  `@theme` breaks. Do not repeat the "freezes the light value" claim; it was measured false.
- Overriding a shadcn default utility by className works because Tailwind emits the larger scale step
  later in the stylesheet (`.text-lg` after `.text-base`) — verified, not assumed.
- `.env.development.local` now points at the hosted DEV project (`iymwxdewcpvpjgzewtzk`), not the
  dead local Docker stack. `next dev` hot-reloads `.env*` changes into an already-running server —
  that is why a warm dev server picked up the switch mid-session without a restart. The old value is
  in this session's scratchpad as `env.development.local.bak`.
- The homepage `/` is a PUBLIC route (`lib/public-routes.ts:23`), so homepage visual checks need no
  Clerk session — just a dev server and Playwright.
- `npm audit --omit=dev` reports moderate DOMPurify advisories via `jspdf@2.5.2` — **pre-existing**,
  unrelated to the jsdom/RTL dev deps, and CI's Security Audit is a soft gate
  (`npm audit --audit-level=high --omit=dev || true`, `.github/workflows/ci.yml:85`).
- `social_posts_single_pinned` (UNIQUE partial index, `20260716000100:134`) allows exactly one
  pinned row. The app never trips it: the admin PATCH routes pins through the atomic
  `pin_social_post` RPC (`app/api/admin/social-posts/[id]/route.ts:31`, ISS-0171). Only bulk
  inserts/updates from a script can hit it — drive selection by `sort_order` there.
- Baseline on both branches: `npm test` 481 passed / 34 files, `npx tsc --noEmit` clean,
  `npm run lint` 0 errors / 465 pre-existing warnings.
- Prod migration ledger head is `20260811000100`, verified 2026-08-12 against `ynykjpnetfwqzdnsgkkg`.
- `playwright.config.ts` never sets `fullyParallel`: Playwright parallelizes by FILE.
- Authenticated e2e cannot run against `.env.local` (PROD credentials). Use the DEV override
  (`iymwxdewcpvpjgzewtzk`). Only a warm-server run is evidence.

## Done
- #751 PLAN + CLAIM + BUILD (`040d822`, `7a57f8b`). Verified: `npm run check-types` clean;
  `npx vitest run` **511 passed / 36 files** (main baseline 507 — the +4 are new `fetchJson` cases
  pinning `status`/`code`/`ApiError`); `npx eslint` on all 8 changed files → 0 errors. `ApiError`
  moved to `lib/api-error.ts` with `apiClient` re-exporting it, so all four existing import sites
  are untouched. **The shared `parseErrorBody` helper was written and then deleted**: `apiClient`
  falls back to `json.message` and `fetchJson` deliberately does not, so sharing it would have
  silently changed `fetchJson`'s message and broken its existing "no error field" test. Route
  changes are log lines only — every status code and response body is byte-identical.
  **NOT visually verified**; no live 500 was exercised to observe the new log output.
- #749 CLAIM + BUILD. Verified: `npx tsc --noEmit` clean; `npm test` **507 passed / 36 files**
  (baseline 494/35 — the 13 new cases are `app/api/events/[id]/request-role/route.test.ts`, the
  route's first coverage ever); `npx eslint` on all 15 changed files → 0 findings; DEV DB probe
  confirms the enum value, both columns and both recompiled functions. **NOT visually verified and
  the new e2e spec has NOT been run** — `e2e/member-role-cancel-auth.spec.ts` needs a warm dev
  server against DEV plus the seeded Clerk member.
- #743 CLAIM + BUILD (`5d1e57a`, `5e67671` + the review fix). **Visually verified locally, unlike
  #740/#741**: dev server against hosted DEV, a seeded `social_posts` row with a 241-char Bulgarian
  caption, Playwright at 390×844 and 1440×900 in **both** themes. Measured — page `scrollWidth`
  375 ≤ 390 and 1425 ≤ 1440 (no overflow); card `scrollWidth == clientWidth` at both sizes; caption
  renders exactly 2 lines in `--on-accent`; the card anchor resolves to `post_url` and the pill to
  the profile with `querySelector('a a') === null` (no nested anchor); no-thumbnail post falls back
  to `card--forest`; empty state still `card bento-tile flex flex-col` with the coming-soon copy.
  `tsc` clean, `npm test` 481 passed, lint 0 errors. The seed row and its local image were removed
  afterwards — DEV `social_posts` is back to 0 rows.
- #743 verified on the **Vercel preview** too (`tevd-portal-mym1ogste`, DEV-backed, reached with a
  `_vercel_share` bypass link from the Vercel MCP — preview deployments are auth-protected): at
  390×844 and 1440×900 in both themes the hero image loads from DEV storage, caption is 2 lines,
  `a a` is null, page `scrollWidth` 375/1425 against 390/1440.
- `/code-review low` on #743 found one real issue — in hero mode every child is absolute, so the
  card had no intrinsic height and depended on its call sites for one. Fixed with `min-h-[200px]`;
  re-measured heights unchanged (198px mobile, 218px desktop).
- #740 BUILD — A1–A5 plus the two-tier radius revision and the Phase 1 sweep. Verified: tsc clean,
  `npm test` 481 passed, lint 0 errors/465 warnings, real `app/globals.css` compiles to
  `rounded-control → var(--radius-control)` and `rounded-container → var(--radius-container)`, and
  every surviving `rounded-full` in Phase 1 scope (27 sites) audited against the circular list.
  **NOT visually verified.** Branch `dev/2608-DEV-740`, PR #744 (draft).
- #741 C1 BUILD — Verified: tsc clean, `npm test` 481 passed, lint unchanged, real `globals.css`
  emits `bg-bg-card → var(--bg-card)`, `text-link → var(--link)`, `bg-bg-card/50 → color-mix(...)`,
  `dark:shadow-lg → &:where([data-theme="dark"] *)`. **NOT visually verified.** Branch
  `dev/2608-DEV-741`, PR #745 (draft, stacked).
- #730 merged as PR #739; #734 as #738; #733 as #737; #726 as #735; #727 as #736; #718 as `4ac7228`.
- #702 CLOSED (epic, 2026-08-12) — all ten children and all six follow-ups merged.

## Open items
- **NOTED (#749), pre-existing, deliberately not fixed:** `fn_schedule_guest_reminders_record`'s
  `ON CONFLICT ... DO UPDATE SET status = 'pending', attempts = 0` has no `WHERE`, so re-confirming
  a registration resets an **already-sent** reminder back to pending. Reachable today via
  attend → cancel → attend, so #749 does not open the door — but it is real.
- **NOTED (#749), accepted side effect:** `lib/server/event-capacity.ts:41-45` excludes approved
  role holders from the guest headcount. After a cancel the person keeps their registration and
  starts counting, so an at-capacity event can end up one over. Derived count, tolerable.
- **NOTED (#749), pre-existing, out of scope:** `event_role_requests.event_id` has no
  `ON DELETE CASCADE` (`baseline.sql:158`), unlike `event_role_slots` — deleting a calendar event
  that has role requests still fails on the FK.
- **FILED as #746** — Radius Phase 2 (`app/admin/**`). 61 pill-shaped `rounded-full` →
  `rounded-control`, ~80 containers stranded on `rounded-lg`/`rounded-xl` → `rounded-container`.
  The issue carries the shared-component shortlist and both admin ambiguities. Until it lands, admin
  renders at the control tier by default — visible but internal-facing, and called out in
  DESIGN-SYSTEM.md § Rounding.
- **OPEN (#741 C4):** `--text-tertiary` fails WCAG AA in BOTH themes — 3.15:1 light, 3.94:1 dark on
  `--bg-card` — and is never redefined for dark at all. Not fixed in C1 because it moves light-mode
  pixels and "light mode visually unchanged" is C1's review invariant.
- **NOTED (#740), deliberately deferred:** `app/(dashboard)/profile/components/StatusBadge.tsx:50` is
  `className={className ?? DEFAULT_CLASSNAME}` — a **replacement, not a merge**. Eight callers pass a
  className and thereby silently drop `inline-flex items-center`
  (`InvitesSection.tsx:286,371,390`, `shared.tsx:62,150`, `ParticipationSection.tsx:54`,
  `payments/PaymentsLedgerClient.tsx:324,397`). The plan said to fix it here; I did the radius swap
  only, because adding `inline-flex` changes `display` on eight badges for no radius reason and
  would contaminate this PR's visual review. Fix separately with `cn()`.
- **NOTED (#741 C1):** the 5 pre-existing `dark:` classes (`LinksGuidesTile.tsx:85,:111`,
  `ReminderTable.tsx:68`, `RemindersTab.tsx:85,:119`) are all COLOUR classes. Registering the variant
  makes them fire on the right signal, but under the revised rule colour belongs in tokens —
  `LinksGuidesTile`'s pair is exactly `--hover-surface`. Convert in C2.
- **NOTED (#740):** the calendar Dialog still has no `DialogDescription`, so Radix continues to warn
  about a missing description even though the title is now fixed. One line, not in this ticket.
- **NOTED:** four hand-rolled switch duplicates (`RemindersTab`, `ReminderTable`,
  `EmailSettingsPanel`) should use `components/ui/switch.tsx`.
- Still open from #715: five call sites silently skip on a null `contact_email`
  (`lib/abo/verifyAbo.ts:226`, both spouse-link routes,
  `app/api/admin/members/verify/[id]/route.ts:99`, `lib/server/member-registration.ts`) — a shared
  `resolveProfileEmail()` would fix all six.
- NOTED (same-class as #715): `lib/email/send.ts:129` still reads `if (!config.enabled)`, the check
  #715 tightened to `!== true`. A row holding `"true"` or `1` makes the master kill switch fail OPEN.
- NOTED (same-class, from #710): the case-sensitive email match fixed in the #710 RPC also exists in
  TypeScript at `lib/server/member-registration.ts` — `.eq('email', contactEmail)` in `attendEvent`'s
  D9 adopt step. Needs `citext`/`lower()` or `.ilike()`.
- NOTED: `app/api/calendar/feed-token/route.ts:21,45,81` and
  `app/api/profile/spouse-link/route.ts:138` still `await getBaseUrl()` unguarded.
- NOTED: `e2e/server-watchdog-reporter.ts:57` calls `process.exit(1)`, skipping Playwright's
  `test.afterAll` — seeded rows can be orphaned in the shared DEV project.
- NOTED: `types/supabase.ts:2370` types five `get_event_registrations_for_viewer` returns as
  non-nullable `string` while all five are NULL in normal operation.
- NOTED: a signed-in member blocked by a FULL event still gets `ResendLinkForm` at
  `app/events/[eventId]/register/page.tsx:179` and `:216` — wrong flow for a portal identity.
- NOTED: `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`) still has the
  detached-anchor + synchronous-`revokeObjectURL` pattern fixed in `AddToCalendarMenu.tsx`.
- NOTED: `docs/ai/REF.md` §6 Edge Functions table lists `send-event-reminders` (does not exist) and
  omits `deliver-email-notifications`.
- FLAKE (not a spec defect): `Authenticated E2E (Clerk)` can fail wholesale at `clerk.signIn()` with
  `[Clerk Testing] FAPI request failed after 4 attempts`. Re-run the same commit.

## Failed attempts
- ATTEMPT 1 [L1] (#709 GCR): adding an explicit `role="tab"` to the tab-bar buttons broke all four
  `event-registrations-auth` specs — an explicit ARIA role OVERRIDES `<button>`'s implicit role, so
  `getByRole('button', …)` matched nothing. Lesson: adding an ARIA role is a REFERENCE SWEEP trigger
  for `getByRole` locators, not just for symbol renames.
- ATTEMPT 2 [L1] (#740 A4, first design): "one radius site-wide = the navbar's 16px". Shipped to a
  draft PR and failed visual review — the pills still looked round. Cause: CSS radius clamping (see
  Facts). Lesson: a radius decision cannot be reviewed as a diff; render it. That is what
  `docs/design/radius-bench.html` is for.
