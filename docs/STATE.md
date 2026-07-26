## Goal
BUILD issue #671 (2607-DEV-671, branch `dev/2607-DEV-671`): fix QR share dialog styling in the calendar event popup — missing portal/overlay, padding, border, close button.

## Now
Starting EXECUTE stage — about to edit `app/(dashboard)/calendar/components/popup/EventPopupShell.tsx` lines 195-225.

## Next
1. Rewrite the QR `Dialog` block per the PLAN DoD (portal+overlay, padding/border, header spacing+color, close button, img border, download button restyle).
2. `npm run lint` and `npx tsc --noEmit`.
3. `/code-review low` on the diff, fix findings locally.
4. Push branch, open PR as draft (`Closes #671`), wait CI green + Preview READY.
5. Manual verification per issue's Verification section (desktop + 390px + dark mode, focus/Esc/outside-click, download filename) — needs a running preview since this worktree has no `.env.local`.
6. Mark PR ready → one CodeRabbit pass → batched fix push → merge → GCR (remove CLAIMS.md row, close issue).
7. No migrations in this PR — no prod gate to approve, just confirm prod deploy READY.

## Constraints
- 390px mobile-first.
- No `git push` of commits without the user explicitly asking for a push in-conversation (quote required) — not asked yet this session. (Branch-ref push for CLAIM scaffolding already done per docs/ai/CLAIM.md, that's a separate, already-approved-by-workflow action.)
- Single file only: `EventPopupShell.tsx` — issue explicitly says nothing else in the file or in `EventPopup.tsx` changes.

## Decisions
(none yet — following issue's prescribed change list verbatim, PLAN already validated it against source)

## Facts
- Target block: `app/(dashboard)/calendar/components/popup/EventPopupShell.tsx:195-225` (the QR `Dialog`).
- `components/ui/dialog.tsx` already exports `DialogPortal`/`DialogOverlay` (re-exported from Radix primitives) — no new component work needed, just import + use.
- Reference pattern for portal/overlay usage: `app/(dashboard)/calendar/components/CalendarClient.tsx:163-185`.
- Reference pattern for padding/border/header/button shape: `components/ui/alert-dialog.tsx` (`AlertDialogContent` L36-44, `AlertDialogHeader` L52, `AlertDialogAction` L93-97).
- No existing i18n close-label key in `lib/i18n/domains/calendar.ts` or `events.ts` — use a hardcoded `aria-label`, matching the header close button which also has none today.
- No E2E covers the QR dialog (`e2e/calendar.spec.ts` has zero `qr` matches) — verification is manual/visual only.

## Done
PLAN + CLAIM completed this session: issue #671 Design Checklist + Branch sections added, `dev/2607-DEV-671` branch cut and pushed, `docs/CLAIMS.md` updated (added #671, pruned merged #666 row), committed as 55de0d3.

## Open items
(none yet)

## Failed attempts
(none yet)
