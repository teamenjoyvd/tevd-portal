## Goal
BUILD issue #703 (2608-DEV-703, branch `dev/2608-DEV-703`), first child of epic #702: stop shipping
`calendar_events.meeting_url` in the role-scoped calendar list projection and the ICS feed; point
both at the portal event page instead (epic decision D8).

## Now
All edits applied and verified on `dev/2608-DEV-703` (cut from `origin/main` at `435c58f`, upstream
unset). NOT pushed — no push authorization in this conversation.
- `lib/server/calendar.ts` — `meeting_url` dropped from `LIST_COLUMNS`. New module-local
  `portalEventUrl(portalUrl, eventId)` builds `<portal>/calendar?event=<encoded id>`.
  `buildEventDescription(event, portalUrl)` and `toVEventInput(event, portalUrl)` both gained a
  second parameter and lost `meeting_url` from their param types; the VEVENT `url` and the
  plain-text `Meeting link:` line are now the portal pointer (`Details: …`).
- `types/calendar.ts` — `'meeting_url'` removed from the `CalendarListEvent` pick.
- `app/api/calendar/feed.ics/route.ts` — resolves `await getBaseUrl()` INSIDE the existing try that
  already degrades to an empty feed, so a missing `NEXT_PUBLIC_APP_URL` cannot turn a 200 into a 500.
- `lib/server/calendar.test.ts` — 6 snapshots updated, +4 tests (URL-encoding, stale `meeting_url`
  on the row ignored, VEVENT `url` is the portal, and a `listEventsForRole` projection guard that
  asserts the full `select()` column list).
- `e2e/guest-invite.spec.ts` — new non-serial describe asserting the anonymous `/api/calendar`
  payload carries no `meeting_url`, skipping loudly rather than passing vacuously on an empty list.
- `docs/ai/REF.md` — the two calendar rows in the routes table no longer claim the ICS `URL` is the
  meeting link.

## Next
1. Address any `/code-review low` findings locally.
2. Ask the user before pushing `dev/2608-DEV-703` and opening the draft PR.
3. PR body must carry `Closes #703`; announce the ICS downgrade (phone-calendar users lose one-tap
   join on every event, gated or not — issue #703 "Announce the ICS change").

## Handover — start the follow-up session with this
```
Branch dev/2608-DEV-703 (issue #703, child of epic #702) removes meeting_url from the calendar list
projection and the ICS feed. npm run verify is green (362 tests). Nothing is pushed. Ask the user
before pushing / opening the PR.
```

## Constraints
- Never push to `main`; `dev/2608-DEV-703` only. `git checkout -b dev/2608-DEV-703 origin/main` SET
  origin/main as the upstream; it was unset immediately (`git branch --unset-upstream`), so
  `git rev-parse --abbrev-ref @{u}` -> fatal and a bare `git push` cannot hit main. Re-check after
  every branch cut — the tracking default is the trap, not the push.
- No `git push` unless the user asks for a push in THIS conversation, quoted beside the command.
  NOT GRANTED for `dev/2608-DEV-703` as of 2026-08-09. (The 2026-08-06 grants were scoped to
  `dev/2608-DEV-698` and `dev/2608-DEV-700` and did not carry over.)
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR — NEVER a
  standalone cleanup PR.
- Change only what the DoD requires; log other findings as `NOTED (not done): <thing> <file:line>`.
- Ask before editing `docs/guardrails/PROJECT.md`.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file
  (including .md) for utility candidates; a backslash + hex digits parses as a CSS unicode escape
  and kills `npm run build` with `Invalid code point <n>` pointed at `app/globals.css:1:1`.

## Failed attempts
- ATTEMPT 1 [L1] (#700, size animation): supplied the card's size through framer-motion's `animate`
  prop (`animate={{width: isExpanded ? '100%' : '68%', ...}}`) -> framer received the prop (React
  fiber confirms `animate: {"width":"68%","height":"64%"}`) but emitted a DOM `style` of only
  `{transformStyle, transform}`. `animate` is not scraped into the initially-rendered style, so the
  element had NO width/height at all and shrank to its content: 185x103 inside a 295x220 tile, with
  "expanded" differing from "collapsed" only by the extra coordinates line. Fixed by driving the
  size as MotionValues in `style` instead — those framer always renders, SSR included.
- ATTEMPT 2 [L1] (#700, size animation): `useSpring(1, SIZE_SPRING)` + `expansion.jump(target)` on
  the reduced-motion path -> the size rendered ONE TOGGLE BEHIND the state (click to collapse ->
  still 100%; click to expand -> 68%). `MotionValue.jump()` calls `updateAndNotify` and
  `stopPassiveEffect()` without scheduling framer's DOM render.
- ATTEMPT 3 [L2] (#700, size animation): kept `useSpring` but swapped its options to
  `{type:'tween', duration:0}` under reduced motion and always called `.set()` -> the size froze at
  100% and never moved. L2 hypothesis, read out of the installed source rather than guessed:
  `attachFollow` (which backs `useSpring`) constructs `new JSAnimation(...)` DIRECTLY
  (`motion-dom/dist/es/value/follow-value.mjs:70`), bypassing the zero-duration branch at
  `motion-dom/dist/es/animation/interfaces/motion-value.mjs:64-96` that applies the final keyframe
  via `frame.update`. A zero-duration tween through `useSpring` therefore emits no update at all.
- ATTEMPT 4 [L3] (#700, size animation): `useMotionValue(1)` + `animate(expansion, target, ...)` in
  an effect -> still frozen at 100%. INSTRUMENTATION (this is the L3 evidence): a MutationObserver
  on the card's `style` attribute recorded **0 mutations** across a full toggle, and the attribute
  kept its un-normalized SSR form (`width:100%` — framer's client writes come back spaced, as seen
  in ATTEMPT 2). The console explains why: framer logs "You have Reduced Motion enabled on your
  device. Animations may not appear as expected", and React reports a hydration mismatch in this
  subtree (`style={{opacity:1}}` vs `style={{opacity:"0"}}`, `strokeDasharray "1 1"` vs `"0 1"`)
  with "This won't be patched up".
- RESOLUTION [L4] (#700, size animation): abandoned the framer path for the size entirely and drove
  width/height as plain inline values with a CSS `transition-[width,height]`, which is the idiom the
  rest of this repo already uses. No MotionValue, no reduced-motion special case (`motion-reduce:`
  handles it), and the value is identical on server and client. `AnimatePresence initial={false}`
  was added at the same time — with expanded as the default state the entrance animation ran during
  hydration, which is what produced the mismatch above.

## Decisions
- DECISION (user, 2026-08-06): drop Mapbox rather than guard it. A `mapboxgl.supported()` check plus
  try/catch would have fixed the crash in ~15 lines, but the tile is decorative (non-interactive,
  fixed zoom 12, attribution hidden) and the machinery — WebGL renderer, CDN script, public API
  token — is disproportionate. Removing it deletes the failure mode instead of catching it.
- DECISION (user, 2026-08-06): the replacement is decorative. `LocationMap` renders SVG "streets" at
  fixed percentages and six absolutely-positioned "buildings"; Sofia and San Francisco look
  identical. Loss of real geography accepted. The alternative offered (expanded state showing a
  Mapbox Static Images `<img>`, no WebGL) was declined.
- DECISION (user, 2026-08-06): `framer-motion` added rather than porting the animations to CSS.
- DECISION (2026-08-06): the component takes its strings as props (`location`, `coordinates`)
  rather than calling `t()` itself, so `components/ui/*` stays i18n-agnostic like the rest of that
  directory. `LocationTile` supplies the translations. (`liveLabel` and `expandHint` were props too
  until #700 removed the pill and the hint.)
- DECISION (2026-08-06): ADR-003 marked **Superseded**, not deleted — its record stays. Its stated
  mitigation ("map tiles are non-critical UI — their failure degrades gracefully") was never true;
  nothing caught the constructor. That sentence is why the bug shipped.
- DECISION (2026-08-06): two deliberate deviations from the upstream component, both documented in
  the file header. (1) No width/height animation: upstream animates 240x140 -> 360x280 in fixed
  pixels, which overflows the 358px content box at a 390px viewport and clips inside a fixed bento
  grid row. It fills its container instead and expansion is a cross-fade. (2) All colours mapped to
  brand tokens.
- DECISION (user, 2026-08-06, #700): deviation (1) above was REVISED, not reverted. The user
  reported the cross-fade reads as an instant state flip and asked for the upstream motion back.
  Upstream verbatim is still unavailable (registry needs auth) and its fixed pixel sizes still do
  not fit, so the size spring was rebuilt in PERCENTAGES: the card springs between 68%/64% and
  100% of its tile. The user picked this over literal upstream pixels (which would have grown the
  desktop bento row and everything sharing it) and over a scale-only cross-fade.
- DECISION (user, 2026-08-06, #700): `components/ui/expand-map.tsx` deliberately does NOT honour
  `prefers-reduced-motion`. Trade-off accepted knowingly, on a small decorative tile, after the
  alternatives (honour it properly / split by motion type / user turns the OS setting off) were put
  to the user. NOT a precedent for the rest of the repo.
- BUG this uncovered, worth remembering repo-wide: the old pattern
  `transition={reduceMotion ? instant : …}` with `instant = { duration: 0 }` is WRONG. It keeps the
  state change and removes only the smoothing, so a 4px hover nudge teleports instead of easing —
  which is what the user reported as "the text jumps on mouse over". Reduced motion must suppress
  the MOVEMENT (x: 0, no size/scale change), never merely zero the duration.
- DECISION (2026-08-06, #700): both ends of the size animation are percentages on purpose.
  `node_modules/motion-dom/dist/es/animation/keyframes/DOMKeyframesResolver.mjs:68-87` returns early
  when the two keyframes share a value type, but sends a px <-> % pair down the measurement path
  (`needsMeasurement = true`), resolving the target off the element's bounding box. Same-unit
  keyframes also cannot overflow the tile at 390px, which keeps the overflow spec honest.

## Facts
- BUILD BASELINE, captured 2026-08-06 before any edit: `npm run check-types` -> clean.
- VERIFICATION, after the fix, all on `dev/2608-DEV-698`:
  `npm run check-types` -> clean. `npx eslint` on the changed files -> zero output.
  `npm run lint` -> 0 errors, 463 warnings (all pre-existing). `npm test` -> 27 files / 358 tests
  passed. `npm run build` -> success.
  `npx playwright test --project=mobile-390 --project=desktop e2e/home-no-webgl.spec.ts` -> 6 passed.
  `e2e/mobile-smoke.spec.ts` on both projects -> 16 passed.
- RED PROOF, 2026-08-06 — the guard was proven to fail before the fix by pointing it at live
  production, which still runs the old code: `BASE_URL=https://www.teamenjoyvd.com npx playwright
  test --project=mobile-390 e2e/home-no-webgl.spec.ts` -> 3 failed. No git stashing was involved.
- THE DIAGNOSIS THAT CHANGED MID-TASK, and the reason the spec has two tests: a COLD LOAD DOES NOT
  CRASH. On first paint the Mapbox throw happens inside the CDN `script.onload` handler, escapes
  uncaught, and the tile just stays blank — Playwright's page snapshot of production confirms the
  tile container and its "Sofia, Bulgaria" pill still render. The reported error screen needs a
  RE-MOUNT: `window.mapboxgl` already set, so the effect takes its
  `if ((window as any).mapboxgl) initMap()` branch and throws synchronously inside the `useEffect`,
  which React unwinds to `app/(dashboard)/error.tsx`. Reproduced by hand on
  `https://www.teamenjoyvd.com` with `HTMLCanvasElement.prototype.getContext` patched to return null
  for webgl, then `/` -> `/about` -> `/`. A guard that only covers the cold load passes against the
  broken code — the first draft of the spec did exactly that.
- LAYOUT TRAP, found and fixed during visual verification: `h-full` on the component root did NOT
  fill the tile. `BentoCard` sets `min-height: 200`, not `height`, and a percentage height does not
  resolve against an auto-height parent — the tile rendered ~100px tall. `LocationTile` now passes
  `className="absolute inset-0"`, which is what the old Mapbox container did (`LocationTile.tsx:144`
  before this change).
- The `<pattern id>` in the grid overlay uses `useId()`. The home page mounts this tile TWICE at
  every viewport — `app/(dashboard)/page.tsx:138` (desktop, inside a CSS-only `hidden md:block`,
  which does not unmount) and `:216` (mobile) — so a literal id would duplicate in the DOM.
- The 21st.dev registry endpoint (`https://21st.dev/r/jatin-yadav05/expand-map`) returns
  `{"error":"Authentication required"}`, so `npx shadcn@latest add <that URL>` cannot fetch it. The
  source was pasted in by the user. The component's compiled source is also readable without auth
  from `cdn.21st.dev/jatin-yadav05/expand-map/default/bundle.*.html`, which is how its behaviour was
  confirmed before any code was written.
- Retheme mapping (upstream -> this repo), since the upstream targets stock shadcn base tokens and
  grep confirms this project defines NONE of `--foreground`, `--background`, `--muted`,
  `--muted-foreground`, `--border`: `bg-background`/`fill-background` -> `--brand-moss`;
  `bg-muted` -> `--brand-moss`; `stroke-foreground/*` -> `--brand-parchment` + explicit
  `strokeOpacity`; `bg-muted-foreground/*` -> `rgba(138,133,119,a)`; `text-foreground` ->
  `--brand-parchment`; `text-muted-foreground` -> `--brand-stone`; `bg-foreground/5` and the inline
  `hsl(var(--foreground) / 0.05)` -> `rgba(250,248,243,0.08)` (the `hsl(var(…))` form is invalid
  here and resolves transparent); emerald `#34D399` -> `--brand-sienna`. Dark mode then works for
  free via `[data-theme="dark"]` in `styles/brand-tokens.css:77`. This follows the existing
  `docs/ai/GOTCHAS.md` rule "shadcn CSS vars: edit vended source in components/ui/ to use project
  tokens, not shadcn defaults".
- Accessibility added over upstream: the root was a bare `<div>` with `onClick`, unreachable by
  keyboard. It is now `role="button" tabIndex={0}` with `aria-expanded`, `aria-label={location}` and
  an Enter/Space handler. The e2e spec locates the tile by that role+name — deliberately NOT
  `getByText('Sofia, Bulgaria')`, which also matches the AboutTile paragraph and cost one debugging
  cycle.
- `useReducedMotion` is no longer imported by `expand-map.tsx` at all (#700). The repo-wide guard in
  `app/globals.css:100` is scoped to `.skeleton-shimmer`, `.bento-tile` and `.interactive-lift` —
  NOT a universal `*` selector — and the Location tile carries none of those classes, so removing
  the component-level gate was sufficient and `docs/design/DESIGN-SYSTEM.md`'s reduced-motion rule
  did not need changing.
- MOTION PROOF under emulated reduced motion (throwaway probe, `page.emulateMedia({ reducedMotion:
  'reduce' })`, deleted after): size `100 -> 95.3 -> 87.1 -> 80.3 -> 75 -> 71 -> 67 -> 64.9`
  (overshoot) `-> 67.8 -> 68`; hover nudge transform `0 -> 0.019 -> 0.72 -> 1.66 -> 2.52 -> 3.16 ->
  4.11 -> 4.32` (spring overshoot) `-> 3.98`, i.e. 20+ distinct values where a teleport shows two.
  NOTE for future probes: `test.use({ reducedMotion })` did NOT reach the page — use
  `page.emulateMedia()`. And a synthetic `mouseenter` does not trigger React's hover (React derives
  enter/leave from mouseover/mouseout) — drive it with a real `locator.hover()`.
- BUILD BASELINE for #700, captured before any edit on `dev/2608-DEV-700`: `npm run check-types`
  -> clean. Note `npm install` was required first — the branch before it predated
  `framer-motion@^12.43.0`, so `node_modules` had no copy of it.
- VERIFICATION for #700, on `dev/2608-DEV-700` with a wiped `.next`: `npm run verify` -> exit 0
  (lint 0 errors / 468 warnings, same count as before the change; `tsc --noEmit` clean; 27 files /
  358 tests passed; build compiled in 93s).
  `npx playwright test --project=mobile-390 --project=desktop e2e/home-no-webgl.spec.ts` -> 6
  passed. `e2e/mobile-smoke.spec.ts` on both projects -> 16 passed.
  MOTION PROOF (throwaway probe, `test.use({ reducedMotion: 'no-preference' })`, deleted after):
  sampling the card width per animation frame across a collapse gave
  `100, 100, 71, 69.4, 67, 66.2, 65.6, 65.2, 65, 64.9, 65, 65.3, 66.3, 67, 67.8, 68, 68...` —
  it interpolates, overshoots past the 68% target, and settles. `transitionProperty` reads
  `"width, height"` there and `"none"` on a reduced-motion device.
- #700 e2e trap: the coordinates locator had to be scoped to the tile
  (`tile.getByText(COORDS)`), not the page. Both the desktop and mobile branches of
  `app/(dashboard)/page.tsx` are in the DOM and BOTH now render the coordinates on load, so a
  page-level `.first()` resolves to the `display:none` branch and `toBeVisible()` fails. The role
  locator does not have this problem — hidden subtrees are not in the accessibility tree.
- Worktrees do NOT inherit gitignored env files. `.env.local` / `.env.development.local` had to be
  copied in from the main repo for the dev server to boot (`supabaseUrl is required` otherwise), and
  were deleted again at handover. `.env.local` points at PROD; `.env.development.local` supplies the
  DEV Supabase and wins under Next's precedence.
- CI ON PR #699, all green: Lint, Type Check, Test, Build, Security Audit, Replay migrations,
  Vercel (deployment completed). `390px smoke vs preview` ran the mobile-390 project against the
  REAL preview and the new spec passed there — `home-no-webgl.spec.ts` lines 48 / 75 / 101 all ✓,
  13 passed in 1.6m. `Authenticated E2E (Clerk)` GENUINELY RAN this time (`Running 21 tests using
  2 workers` -> `20 passed (2.2m)`), so this was NOT the vacuous 6-second green tracked as #679 —
  still worth re-confirming on the next run rather than trusting the tick.
- Running the spec against the preview from a dev machine FAILS with "landed off the app origin" —
  that is the guard working, not a defect. Vercel deployment protection redirects to vercel.com
  without `VERCEL_AUTOMATION_BYPASS_SECRET`, which only CI has. Verify preview behaviour by reading
  the `390px smoke vs preview` job log, not by running it locally.
- E2E coverage lives in `e2e/home-no-webgl.spec.ts`. It is collected by the `mobile-390` and
  `desktop` projects (both use `testIgnore`) and excluded from `authenticated` (which uses
  `testMatch`) — no config change was needed.

## Open items
- RESOLVED (#700, user decision 2026-08-06): the reduced-motion gate is GONE from
  `components/ui/expand-map.tsx`. This machine has `prefers-reduced-motion: reduce` set — confirmed
  twice (`matchMedia(...).matches === true`, plus framer logging "You have Reduced Motion enabled on
  your device") — and that, not the code, was the real reason the tile "had no animation": all 20+
  transitions were gated on it. Asked the user to choose between honouring it properly, splitting by
  motion type, or animating regardless; they chose **animate regardless**. See `## Decisions`.
- PR was marked ready for review before the GCR session started (CodeRabbit's 4-comment review at
  11:04 required it, since draft PRs get skipped). One review thread deliberately left unresolved —
  see `## Now`.
- NOTED (not done): `app/(dashboard)/page.tsx:138,216` — `LocationTile` mounts twice at every
  viewport because the desktop branch is CSS-hidden rather than conditionally rendered. Cheap now
  that the tile is pure DOM, but still a duplicated subtree on every load.
- NOTED (not done): no `app/global-error.tsx` exists, so a throw in the root layout has no boundary
  at all — the same class of single-point-of-failure as this bug.
- NOTED (not done): `docs/perf/BASELINE.md` numbers predate the removal of the ~900KB Mapbox CDN
  script and need a re-measure. The row was updated to say so.
- OUT OF BAND, user-owned, after merge: delete `NEXT_PUBLIC_MAPBOX_TOKEN` from the Vercel project
  (all scopes).
- CARRIED: the CI check `Authenticated E2E (Clerk)` has historically gone green in seconds WITHOUT
  running the specs (tracked as #679). Never treat a green tick as proof; confirm 0 skipped.
- CARRIED FROM #677, NEVER VERIFIED: admin guest link/unlink has no automated coverage and has never
  been exercised against a real database. `/admin/payments` -> Guest links -> pick a member -> Link
  -> Unlink.
- CARRIED FROM #677: DEV fixtures still present and uncleaned — `seed_676_*` (7 profiles, ABOs
  6760001-6760004) and a `payment_guests` row named `E2E Guest Nadia`. Both still needed by the
  authenticated E2E.
- CARRIED FROM #676, UNMEASURED: does PROD have `payments` rows? If yes, `/profile` was crashing in
  production for every such user between 2026-07-27 (`570d587`, #670) and the #676 merge. One
  read-only query answers it: `select count(*), count(distinct profile_id) from payments`.
- CARRIED, NOTED (not done): `app/(dashboard)/profile/components/PaymentsSection.tsx:30`
  `pendingGroupsIPaidFor` filters `paid_by_profile_id !== myProfileId` directly rather than through
  `payerOf`, so a legacy pending group with a NULL `paid_by_profile_id` is not offered a withdraw
  card.
- CARRIED, NOTED (not done): `app/(dashboard)/profile/components/shared.tsx:103` gates the
  cancelled-trip info marker on `payable_items?.item_type === 'trip'`, always false for a real trip
  payment (its `payable_items` is NULL). Same file `:131-133` renders `proof_url` as an `href`
  although it is a private-bucket storage KEY, not a URL (`lib/payments/proof.ts:1-10`).
- CARRIED FLAKE, not caused by this work: `e2e/payments-on-behalf.spec.ts:169` failed a
  `toBeVisible()` at 36.3s then passed on retry — a cold-server timing profile, same shape as the L8
  flake logged during #688.

## Done
- #696 (merged as #697, `dab0677`) — the transitional `PGRST202`/`42883` fallback removed from
  `lib/rate-limit.ts`; every RPC error now fails closed. Its `docs/CLAIMS.md` row is pruned here.
- #694 (merged as #695, `7234846`) — `price_checker` DB role dropped from DEV. STILL OUTSTANDING,
  user-owned: rotate the `postgres` superuser password of Supabase project `isthoadgyqdmjmapvpzj`.
- #625 (merged as #693, `13af882`) — atomic check-then-act guest-invite rate limits; prod migration
  applied, ledger head `20260804000100`.
