# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #740 | `dev/2608-DEV-740` | QA polish: `app/(dashboard)/calendar/components/{MonthView.tsx,popup/*}`, `app/(dashboard)/components/tiles/TripHeroTile.tsx`, `app/(dashboard)/profile/components/{AboInfoContent,StatusBadge}.tsx`, `components/layout/Footer.tsx`, `components/ui/{tooltip,sonner,vaul-drawer}.tsx`, `styles/brand-tokens.css` (radius only), `app/globals.css` (`@theme` radius keys only), `docs/design/DESIGN-SYSTEM.md` — **migration: no** | 2026-08-13 |
| #741 | `dev/2608-DEV-741` | Dark-mode foundation (C1 only): `styles/brand-tokens.css` (colour tokens), `app/globals.css` (`@theme inline`, `color-scheme`, `@custom-variant dark`), `docs/design/DESIGN-SYSTEM.md` — **migration: no**. ⚠️ Overlaps #740 on both CSS files; branch is **stacked on `dev/2608-DEV-740`**, PR base is that branch, not `main`. C2/C4/C5 phases are deliberately NOT in this claim. | 2026-08-13 |

