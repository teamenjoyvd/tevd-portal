## Goal
Issue #642 (2607-DEV-642, branch `dev/2607-DEV-642`): admin registrations tab mislabels cancelled guests as "Pending" — fix the status ternary to distinguish cancelled from pending.

## Now
PR [#668](https://github.com/teamenjoyvd/tevd-portal/pull/668) open as **draft** against `main` (`Closes #642`), branch `dev/2607-DEV-642` pushed (commit `af611fe`). CI/Preview not yet checked this turn — draft was just opened.

## Next
- Check CI status and Vercel Preview READY on PR #668.
- Manual visual check on preview: admin > calendar > event > Registrations tab shows "Cancelled" (red) for a cancelled guest; 390px check.
- When ready: mark PR ready for review to trigger the single CodeRabbit pass (per docs/ai/BUILD.md FINALIZE), address findings in one batched push.
- After merge: run the post-merge tail (prod Vercel deploy check, confirm issue #642 auto-closed, remove `docs/CLAIMS.md` `#642` row).

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No failing check gets weakened/skipped to pass
- Change only lines the task requires

## Facts
- `guest_registrations.status` enum (`20260410000001_guest_event_registrations.sql:3`) only ever stores `'pending'`/`'confirmed'` at the DB layer; `app/api/admin/events/[id]/registrations/route.ts:51` synthesizes `'attended'`/`'cancelled'` from `attended_at`/`cancelled_at` before returning. So `g.status` on the client can only be one of exactly 4 values — the new `REGISTRATION_STATUS_STYLES` map's keys cover all of them, `?? .pending` fallback is defensive/unreachable.
- `app/(dashboard)/calendar/components/popup/styles.ts` pattern: one exported `*_STYLES` const per status-pill shape used in this popup dir (`SLOT_STATUS_STYLES` for role slots, `REQUEST_STATUS_STYLES` for role requests, now `REGISTRATION_STATUS_STYLES` for guest registrations) — each a plain `{ key: { bg, color } }` map of hardcoded hex/rgba, not CSS tokens.

## Done
#642 CLAIM — RESULT: issue retitled `[2607-DEV-642] ...`, `## Design Checklist` (4/4 checked) + `## Branch` appended to issue body, branch `dev/2607-DEV-642` cut from `main` and pushed, `docs/CLAIMS.md` row registered (pruned stale `#613` row, its PR #664 already merged).
#642 BUILD (code) — RESULT: `CoreAdminActions.tsx` (status ternary replaced with `REGISTRATION_STATUS_STYLES` lookup + explicit `status === 'cancelled'` branch, dropped `!!attended_at` truthiness check), `styles.ts` (new `REGISTRATION_STATUS_STYLES` map, cancelled color reuses `REQUEST_STATUS_STYLES.denied`'s `#bc4749`/`#bc474920`). `npm run build` exit 0 (full route manifest, TypeScript clean) after `npm install` synced 57 missing packages into `node_modules` (`package-lock.json`/`package.json` unchanged — local sync only, pre-existing gap unrelated to this ticket). `npm run lint` 0 errors/480 warnings (none in changed files). Manual diff review done (`/code-review` skill is user-invocation-only, not callable this session) — traced `guest_registrations` status enum to confirm no other status value reaches the branch. Draft PR #668 opened.

## Open items
- No local authenticated visual check on the Vercel Preview yet this turn (PR just opened) — needs confirmation once Preview is READY.
- PR marked ready for review only after CI green + Preview READY + manual check, per BUILD.md VERIFY stage.
