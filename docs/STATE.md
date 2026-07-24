## Goal
Issue #631 (2607-DEV-631, branch `dev/2607-DEV-631`): migrate the mobile hamburger nav drawer in `components/layout/Header.tsx` from a hand-rolled `<div>` to the shadcn `Sheet` component (focus trap, ESC-close, `role="dialog"`/`aria-modal` via Radix).

## Now
User said "ready to draft PR" — pushing branch and opening the draft PR now.

## Next
- `git push -u origin dev/2607-DEV-631`, open PR as **draft** (`Closes #631` in body), verify CI green + Vercel Preview READY. Icon/pill/scrollbar tweaks were only sanity-checked via a temporary in-browser CSS override forcing `.lg\:hidden` visible at desktop width, NOT a real 390px viewport — ask the user to re-check the live Vercel preview at 390px before marking Ready.
- Mark ready for review to trigger CodeRabbit, address findings in one batched push, FINALIZE per `docs/ai/BUILD.md`.
- After merge: remove the `#631` row from `docs/CLAIMS.md`, close the issue. No migration, so no `migrate-prod` gate to approve.

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — asked 2026-07-24, user answered "Not yet", so still holding
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No failing check gets weakened/skipped to pass

## Decisions
DECISION: Kept Radix's default `SheetOverlay` (visible `rgba(0,0,0,0.35)` dim backdrop) instead of forcing it invisible to match the old click-catcher exactly — normal Sheet/Dialog behavior, doesn't conflict with "preserve nav item content/styling" (that's about the panel's contents, not the overlay), reasonable UX improvement. Not user-confirmed explicitly but flagged in PLAN Notes and not objected to.
DECISION: `SheetContent` positioned via `top-20` (hardcoded 5rem = header's `top-4` + `h-14` + `mt-2`) + `inset-x-4` + `max-w-[1440px] mx-auto`, with a full custom inline `style` (background/border/shadow/blur) replacing `sheet.tsx`'s default `var(--bg-card)` styling, to visually match the pre-existing dropdown panel exactly. Reviewed risk: this hardcoded offset won't auto-adjust if the header's height/margins change later (previously the drawer was in-flow via `mt-2` and self-adjusted) — logged as a NOTED item, not fixed, since header height isn't changing in this ticket.
DECISION (user-directed, post-visual-review): sped up `components/ui/sheet.tsx`'s `sheetVariants` transition from `duration-300`/`duration-700` (closed/open) to `duration-150`/`duration-200` — global change to the vended Sheet component (its only current consumer is this Header).
DECISION (user-directed, post-visual-review, explicit "change it everywhere" after being told of the blast radius): changed `.pill-link-crimson`'s hover pill from `border-radius: 9999px` to `0.5rem` in `styles/brand-tokens.css` — this is a **shared global class used in 9 files** (desktop nav in this same Header, `trips/[id]/components/shared.tsx`, `library/[slug]/page.tsx`, dashboard tiles ×4, `news/[slug]/page.tsx`), so the squarer hover pill now applies site-wide, not just the mobile drawer. This is beyond issue #631's stated scope ("no change to nav item content, styling") but was explicitly requested and confirmed by the user after being told the exact blast radius.
DECISION (user-directed, round 2): user noticed the homepage bento's SIGN IN pill (`app/(dashboard)/components/tiles/ProfileTile.tsx:93`, uses `.pill-link-parchment` not `.pill-link-crimson`) still looked fully round and asked to align ALL pills — so `.pill-link-parchment` also changed `9999px` -> `0.5rem` in the same commit, superseding the earlier "leave parchment alone" read of "red hover effect." No more shape inconsistency between the two pill classes.
DECISION (user-directed, round 2): user reported the page background/header visibly shifts sideways when the mobile Sheet opens ("scrollbar effect") on desktop Chrome. Root cause: Radix's dialog scroll-lock sets `overflow: hidden` on the body, which removes the browser's scrollbar and widens the viewport, and the header is `position: fixed; right: 0` so it visibly jumps. Fix: added `scrollbar-gutter: stable;` to the `html` rule in `app/globals.css` — permanently reserves the scrollbar's width so toggling the scrollbar never changes viewport width. Standard fix, well-supported (Chrome/Firefox/Edge, recent Safari); not yet visually confirmed against a real scrollbar-bearing page by either of us this session.
DECISION (user-directed, round 2): added minimalist lucide-react outline icons (Home/Info/Calendar/Plane/BookOpen/Shield/User, `lucide-react` v0.511 already a dependency) to each mobile-drawer nav link only (not desktop nav) via a local `NAV_ICONS` href-keyed map in `Header.tsx` — kept local rather than adding an `icon` field to the shared `NavItem` type in `lib/nav.ts` (also consumed by Footer/AdminNav) to avoid touching a shared file for a Header-only cosmetic change. Icons render via lucide's default `stroke="currentColor"` (no explicit color prop) so they inherit `.pill-link-crimson`'s text color at rest and on hover — satisfies "not colored"/monochrome without extra CSS.

## Facts
- Files touched this session: `components/layout/Header.tsx`, `components/ui/sheet.tsx`, `styles/brand-tokens.css`, `app/globals.css`. No new files, no migration.
- Three local commits on `dev/2607-DEV-631`, not pushed: `c1508cd` (CLAIMS.md registry row), `1a18b65` (the Sheet migration + animation speed-up + `.pill-link-crimson` radius change), `4e43109` (`.pill-link-parchment` radius alignment + `scrollbar-gutter: stable` + mobile drawer icons).
- `tsc --noEmit` clean, `npm run lint` 0 errors / 492 warnings (baseline unchanged except one new expected `i18next/no-literal-string` warning on the new `sr-only` `SheetTitle`).
- Dev server: browser automation's `resize_window` could not shrink the viewport below ~1680px in this session (tried multiple tabs, tab-group recreation, `window.resizeTo`) — 390px verification was done by the user directly against their own browser/preview, not by me via screenshot.
- `docs/CLAIMS.md` row: `#631 | dev/2607-DEV-631 | components/layout/Header.tsx; migration: no`. The prior `#653` row was pruned (that PR already merged as #656/#657 before this session started).

## Done
#631 PLAN — RESULT: READY verdict, DoD scoped to `components/layout/Header.tsx` only (Sheet already vended, unused). Output printed in chat.
#631 CLAIM — RESULT: issue body updated with `## Design Checklist` (all 4 checked) + `## Branch`; branch `dev/2607-DEV-631` cut from `main` (`d0bd4eb`); `docs/CLAIMS.md` updated (added #631 row, pruned stale merged #653 row).
#631 BUILD (in progress) — RESULT: `Header.tsx` rewritten (qualified for the CLAUDE.md rewrite exception: file already fully read, >half the lines changed, behaviors enumerated before rewrite) to use `Sheet`/`SheetTrigger`/`SheetContent`/`SheetTitle`; manual keydown-ESC `useEffect` and manual backdrop `<div>` removed (superseded by Radix Dialog's native handling). Self-review done (tool-invoked `/code-review` unavailable to me directly; did the equivalent pass manually against `git diff main..dev/2607-DEV-631`) — no correctness/security issues, 3 NOTED items (hardcoded `top-20` offset, `.pill-link-crimson`/`.pill-link-parchment` shape inconsistency, no `SheetDescription`). User did their own live visual check and confirmed the drawer works, then requested two follow-up tweaks (animation speed, hover pill shape) — both implemented and verified (tsc/lint clean) in the second commit.

## Open items
- Push branch + open draft PR — blocked on user's explicit go-ahead (asked once, got "Not yet"; not re-asked since round 2)
- CI green + Vercel Preview READY check (can't happen until pushed)
- CodeRabbit pass after marking ready for review
- Round-2 changes (icons, scrollbar-gutter, parchment radius) were only sanity-checked via a temporary in-browser CSS override (forced `.lg\:hidden` visible at 1680px, forced `.hidden.lg\:flex` hidden) since real 390px viewport testing is still blocked in this environment — ask the user to re-verify against the actual mobile breakpoint/live preview before Ready

## Failed attempts
ATTEMPT: get a real 390px screenshot via `mcp__claude-in-chrome__resize_window` — tried on 2 different tabs, recreated the tab group, tried `window.resizeTo()` from page JS, and toggling `win+down` to un-maximize first. Every time, `resize_window` reported success but `window.innerWidth` stayed at 1680px. Root cause not identified (likely an environment/window-manager constraint on the Chrome window itself, not an extension logic bug). Not retried further per browser-tool guidance (stop after 2-3 failures); asked the user instead, who verified 390px themselves.
