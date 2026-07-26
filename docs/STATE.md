## Goal
BUILD issue #666 (2607-DEV-666, branch `dev/2607-DEV-666`): Profile bento standardization 2 — semantic status token consolidation (`StatusBadge`, delete `PAYMENT_STATUS_STYLES`/`REG_STATUS_STYLES`/`EXPIRY_STYLES`), unified `ProfileBackLink` on the 3 drill pages, remaining raw-colour-literal sweep, shadcn `AlertDialog` for trip cancel, `next/link` for AdminSection.

## Now
Starting EXECUTE stage. Local branch `claude/build-666-5662de` fast-forwarded to include `origin/dev/2607-DEV-666`'s CLAIM-registration commit (063b990) — CLAIMS.md now has the #666 row, stale #665 row already pruned by that commit.

## Next
1. Step 5: brand-tokens.css neutral tokens + DESIGN-SYSTEM.md doc, StatusBadge.tsx, EXPIRY_TOKEN in types.ts, route shared.tsx/ParticipationSection/InvitesSection through it, TravelDocContent/TravelDocDrawerForm dedupe, remaining literal sweep, profile-refactor.md doc update.
2. Step 6: ProfileBackLink.tsx + 3 drill pages + i18n key, AlertDialog for shared.tsx TripRow cancel, AdminSection next/link.
3. Verification per issue's Verification section (build/lint, e2e, both-theme badge check, AlertDialog check, back-link check, admin nav check).
4. `/code-review low` before first push; push draft PR with `Closes #666`.

## Constraints
- 390px mobile-first.
- shadcn/ui for all interactive primitives (AlertDialog for trip-cancel confirm).
- Component co-location — StatusBadge/ProfileBackLink stay under `app/(dashboard)/profile/components/`.
- No Tailwind `dark:` variants — use `[data-theme="dark"]` selectors.
- `--status-neutral-*` is shared CSS — verify no unintended change to `/admin` (consumes same token block via StatusPill).
- Each page's existing max-width (1280/900/860 drift) is NOT fixed here — logged as NOTED only.
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — not asked yet this session.

## Decisions
(none yet — following issue's Step 5/6 ordering verbatim)

## Facts
- `styles/brand-tokens.css` already has 4 status pairs (success/info/alert/pending) light (L54-61) + dark (L93-100) — neutral is a 5th pair to add in both blocks.
- `components/admin/StatusPill.tsx` is the pattern to mirror for `StatusBadge` — switch-based token+label, `{status}->{token,label}`, inline `style` backgroundColor/color from `var(--status-{token}-bg/fg)`. `StatusBadge` takes `{status, children}` instead (caller supplies label).
- `PAYMENT_STATUS_STYLES`/`REG_STATUS_STYLES` (app/(dashboard)/profile/types.ts:173-190) consumed by: `components/shared.tsx` (TripRow L35-37/51-56, PaymentRow L80/92-96), `ParticipationSection.tsx` (RoleRow L41/54-55), `InvitesSection.tsx` (L285 revoked badge, L370-371 desktop table badge, L390-391 mobile card badge) — L285/370/390 spread `style={REG_STATUS_STYLES[...]}` directly (bg/color valid CSS props here, NOT the `{bg,color}` object form the issue calls a bug — re-verify against issue text before assuming no bug).
- `EXPIRY_STYLES` duplicated verbatim in `TravelDocContent.tsx:54-58` and `TravelDocDrawerForm.tsx:14-18` (Tailwind arbitrary-value classes, not inline style objects).
- Drill pages: `profile/invites/page.tsx` (Server Component, hardcoded `← Back to Profile` Link L13-19), `profile/los-upload/LosUploadClient.tsx` (Client, no-abo return ~L149-160, main return ~L162-270, no back link), `profile/spouse-link/SpouseLinkClient.tsx` (Client, single top-level return ~L304, no back link).
- i18n: flat-key format in `lib/i18n/domains/profile.ts` (`'profile.key': { en, bg }`), re-exported via `lib/i18n/translations.ts` shim. No `profile.backToProfile` key exists yet.
- `components/ui/alert-dialog.tsx` shadcn wrapper already used elsewhere in profile (InvitesSection revoke, CalendarSection regenerate) — same import pattern to follow for shared.tsx TripRow cancel.
- AdminSection.tsx: single `<a href="/admin">` in an 8-col inline grid built for exactly one tile.

## Done
Step 5 + Step 6 — RESULT: `--status-neutral-bg/fg` tokens (light+dark) added to `brand-tokens.css` + documented in `DESIGN-SYSTEM.md`; `StatusBadge.tsx` created (mirrors `StatusPill`, caller supplies label, identity token entries let `EXPIRY_TOKEN` pass through); `PAYMENT_STATUS_STYLES`/`REG_STATUS_STYLES` deleted from `types.ts`, replaced by `ExpiryState`/`EXPIRY_TOKEN`; `shared.tsx` (TripRow bug fixed — `style={REG_STATUS_STYLES[s]}` never set `backgroundColor` since `bg` isn't a CSS prop; PaymentRow), `ParticipationSection.tsx`, `InvitesSection.tsx` (3 sites) all routed through `StatusBadge`; `TravelDocContent.tsx`/`TravelDocDrawerForm.tsx` `EXPIRY_STYLES` duplication replaced by `EXPIRY_TOKEN` via `StatusBadge` (border via `color-mix()`); literal sweep done (AboInfoContent 11 sites, VitalsSection, InvitesBento incl. new light-mode `--bg-card-raised` token, InvitesSection, PaymentsSection/AboInfoContent `text-white`→`var(--brand-parchment)`, CalendarSection `hover:bg-black/5`→`hover:opacity-80`); `profile-refactor.md` updated; `ProfileBackLink.tsx` created + wired into all 3 drill pages + `profile.backToProfile` i18n key added; `shared.tsx` TripRow cancel now uses shadcn `AlertDialog` instead of `confirm()`; `AdminSection` bare `<a>` → `next/link`, 8-col grid collapsed to a single `w-fit` link.
`npm install` run (worktree had no `node_modules`). `npm run build` clean. `npm run lint`: 476 warnings vs 477 baseline (confirmed via `git stash`/`stash pop` diff) — no new warnings introduced. `rg 'REG_STATUS_STYLES|PAYMENT_STATUS_STYLES|EXPIRY_STYLES'` returns zero hits outside the removal note in `profile-refactor.md`.

## Open items
- No live browser verification possible: this worktree has no `.env.local` — dev server 500s on `supabaseUrl is required` for any DB-backed route and redirects to `/sign-in` (Clerk keyless mode) — same known gap as #665's session (no local Supabase, no seeded Clerk test user). Both-theme status-badge check, AlertDialog check, back-link check, and AdminSection nav check are all UNVERIFIED against a real running app.
- `npm run test:e2e:auth` not run for real (same env gap) — `playwright test --list` confirms `profile-bento-auth.spec.ts` (from #665) still resolves with no syntax breakage, but that spec doesn't cover this issue's new surfaces anyway.
- Not yet run: `/code-review low` on the diff (BUILD.md EXECUTE step, required before first push).
- Not yet committed or pushed — awaiting explicit user go-ahead per hard constraints.

## Failed attempts
(none yet)
