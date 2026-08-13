## Goal
Two stacked tickets, both open as DRAFT PRs, neither merged.

- **#740** (`dev/2608-DEV-740` → PR **#744**, base `main`): QA polish — calendar bubble insets,
  popup title + dark-mode contrast, Trips bento deep link, and a **two-tier corner radius system**.
- **#741** (`dev/2608-DEV-741` → PR **#745**, base **`dev/2608-DEV-740`**): C1 only of the dark-mode
  foundation — fill the token gaps and make every semantic token a Tailwind utility.

## Now

**#741 is stacked on #740.** PR #745's base is `dev/2608-DEV-740`, NOT `main`, because both branches
edit `styles/brand-tokens.css` and `app/globals.css`. Merge #744 first; GitHub retargets #745
automatically. #741 **has** been rebased onto the two-tier radius work; both CSS files auto-merged
(the radius tokens and the colour tokens are disjoint additions to the same blocks).

### #740 — what landed
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
1. Vercel preview READY + CI green on both, then the **visual pass — the real gate**. At 390px and
   desktop, in **both** themes: status badges and filter chips must show a flat edge;
   cards/dialogs/navbar read at 8px; check the mobile event popup's top corners, the Footer social
   row (now 4px squares, was circles), and the Trips hero tile (the surface most at risk at 8px).
2. `/code-review low` on each, then mark ready for CodeRabbit and apply GCR.
3. File the **Phase 2** issue (see Open items) for `app/admin/**`.
4. `npm run verify` deliberately NOT run locally: its `next build` runs under `NODE_ENV=production`,
   which on this box resolves `.env.local` = PROD. CI builds it on the PR.

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
- Baseline on both branches: `npm test` 481 passed / 34 files, `npx tsc --noEmit` clean,
  `npm run lint` 0 errors / 465 pre-existing warnings.
- Prod migration ledger head is `20260811000100`, verified 2026-08-12 against `ynykjpnetfwqzdnsgkkg`.
- `playwright.config.ts` never sets `fullyParallel`: Playwright parallelizes by FILE.
- Authenticated e2e cannot run against `.env.local` (PROD credentials). Use the DEV override
  (`iymwxdewcpvpjgzewtzk`). Only a warm-server run is evidence.

## Done
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
- **OPEN — Phase 2 of the radius migration (`app/admin/**`), not yet filed as an issue.** Audited
  work: **61 pill-shaped `rounded-full` sites** → `rounded-control`, and **~80 containers stranded
  on `rounded-lg`/`rounded-xl`** → `rounded-container`. High-leverage shared components to do first
  (one edit each, many call sites): `app/admin/calendar/components/Pill.tsx:8`,
  `app/admin/components/AdminStatusBadge.tsx:15`, `app/admin/components/RoleSelector.tsx:29`,
  `app/admin/components/AdminTabs.tsx:65`. Two admin ambiguities deferred with it:
  `AdminTabs.tsx:65` (count badge — near-circular at one digit) and `MembersTable.tsx:113` (24px
  circular ABO-level token). Until this lands, admin renders at the control tier by default —
  visible but internal-facing.
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
