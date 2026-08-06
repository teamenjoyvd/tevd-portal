## Goal
BUILD issue #698 (2608-DEV-698, branch `dev/2608-DEV-698`): remove Mapbox GL from the app entirely
and render the home page's Location tile with a self-contained DOM/SVG component, so no WebGL
failure can reach the dashboard error boundary.

## Now
Code complete, verified locally, draft PR open. Net −362/+93 across 19 files plus two new files.
Mapbox is gone: the CDN loader, the `NEXT_PUBLIC_MAPBOX_TOKEN` env var, the `.mapboxgl-ctrl-*` CSS
suppression, the orphaned `AboutMapTile*` pair, and the `ssr:false` `LocationTileLazy` wrapper.
`components/ui/expand-map.tsx` (adapted from 21st.dev `jatin-yadav05/expand-map`) draws the card in
SVG and cannot fail. `framer-motion@^12.43.0` is a new dependency.

## Next
1. `/code-review` the diff in a fresh session (see `## Handover` below).
2. Address findings, then mark the PR ready for review — ASK the user first.
3. Vercel preview READY + CI green before Done.
4. Post-merge: prune the `docs/CLAIMS.md` #698 row, close #698, and ask the user to delete
   `NEXT_PUBLIC_MAPBOX_TOKEN` from the Vercel project (all scopes) — out-of-band, not a code change.

## Handover — start the follow-up session with this
```
/code-review PR #699 (branch dev/2608-DEV-698, issue #698): Mapbox GL removed from the app and the
home page Location tile replaced with components/ui/expand-map.tsx, a DOM/SVG card adapted from
21st.dev jatin-yadav05/expand-map. Read docs/STATE.md first — it carries the verified facts, the
retheme rationale, and the two deliberate deviations from upstream. Focus on: (1) the brand-token
retheme in expand-map.tsx, since the upstream component targets shadcn base tokens this project
does not define and a missed substitution renders invisible rather than erroring; (2) whether
e2e/home-no-webgl.spec.ts actually guards both failure shapes documented in #698; (3) the
NEXT_PUBLIC_MAPBOX_TOKEN reference sweep for anything left live. Do not re-run the red-proof
against production — it is recorded under Facts.
```

## Constraints
- Never push to `main`; `dev/2608-DEV-698` only. `git checkout -b dev/2608-DEV-698 origin/main` SET
  origin/main as the upstream; it was unset immediately (`git branch --unset-upstream`), so
  `git rev-parse --abbrev-ref @{u}` -> fatal and a bare `git push` cannot hit main. Re-check after
  every branch cut — the tracking default is the trap, not the push.
- No `git push` unless the user asks for a push in THIS conversation, quoted beside the command.
  GRANTED 2026-08-06, verbatim: "Open a draft PR since change like any other must go through the
  standard procedure." Scope: push `dev/2608-DEV-698` and open the PR AS A DRAFT. Does NOT cover
  marking it ready for review or merging — ask again for both.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR — NEVER a
  standalone cleanup PR.
- Change only what the DoD requires; log other findings as `NOTED (not done): <thing> <file:line>`.
- Ask before editing `docs/guardrails/PROJECT.md`.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file
  (including .md) for utility candidates; a backslash + hex digits parses as a CSS unicode escape
  and kills `npm run build` with `Invalid code point <n>` pointed at `app/globals.css:1:1`.

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
- DECISION (2026-08-06): the component takes its strings as props (`location`, `coordinates`,
  `liveLabel`, `expandHint`) rather than calling `t()` itself, so `components/ui/*` stays
  i18n-agnostic like the rest of that directory. `LocationTile` supplies the translations.
- DECISION (2026-08-06): ADR-003 marked **Superseded**, not deleted — its record stays. Its stated
  mitigation ("map tiles are non-critical UI — their failure degrades gracefully") was never true;
  nothing caught the constructor. That sentence is why the bug shipped.
- DECISION (2026-08-06): two deliberate deviations from the upstream component, both documented in
  the file header. (1) No width/height animation: upstream animates 240x140 -> 360x280 in fixed
  pixels, which overflows the 358px content box at a 390px viewport and clips inside a fixed bento
  grid row. It fills its container instead and expansion is a cross-fade. (2) All colours mapped to
  brand tokens.

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
- `prefers-reduced-motion` gates the mouse-tilt only (via `useReducedMotion`); the entrance
  animations still run.
- Worktrees do NOT inherit gitignored env files. `.env.local` / `.env.development.local` had to be
  copied in from the main repo for the dev server to boot (`supabaseUrl is required` otherwise), and
  were deleted again at handover. `.env.local` points at PROD; `.env.development.local` supplies the
  DEV Supabase and wins under Next's precedence.
- E2E coverage lives in `e2e/home-no-webgl.spec.ts`. It is collected by the `mobile-390` and
  `desktop` projects (both use `testIgnore`) and excluded from `authenticated` (which uses
  `testMatch`) — no config change was needed.

## Open items
- NOT YET DONE: Vercel preview READY + CI green. The PR is a DRAFT.
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
