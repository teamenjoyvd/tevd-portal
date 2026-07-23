## Goal
Issue #602 (2607-DEV-602, branch `dev/2607-DEV-602`): Calendar refactor 6/8 — test coverage (Sofia-TZ date utils + `lib/format.ts` DST boundaries, ICS description snapshot, unauthenticated calendar e2e smoke).

## Now
PR [#651](https://github.com/teamenjoyvd/tevd-portal/pull/651) open (ready for review, not draft). CI green (Build/Lint/Test/TypeCheck/SecurityAudit/migrations-replay/`390px smoke vs preview`/Vercel) as of the GCR fix commit `a2ba772`. CodeRabbit's re-review after that commit came back "rate limited" (not re-run) rather than clean — not yet a second genuine CodeRabbit pass.

## Next
- Get a real CodeRabbit re-review on commit `a2ba772` (current one was rate-limited) or confirm no new findings another way before merging
- Merge PR #651 (squash, matches repo convention)
- Post-merge tail: `migrate-prod` should auto-skip (no migrations in this PR); smoke-check `https://www.teamenjoyvd.com`; issue #602 auto-closes via the PR's `Closes #602`. `#602`'s `docs/CLAIMS.md` row was removed ahead of merge per explicit user instruction (CI green, PR waiting on the cleanup merge) — not the normal post-merge-only rule
- Separately outstanding: issue #601's post-merge tail was never finished last session (prod smoke-check / `migrate-prod` confirmation not verified) — worth a quick check next time prod state comes up, though its `docs/CLAIMS.md` row has now been pruned (issue closed, PR #649 merged 2026-07-23T11:27:39Z)

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No `git push` without the user explicitly asking for a push in-conversation (quote required)
- No failing check gets weakened/skipped to pass
- Never spin a solo cleanup-only PR just to prune a `docs/CLAIMS.md` row — fold it into the merging feature PR (repeat past mistake, see `feedback_no_standalone_claims_cleanup_pr` memory)
- A `blocked` GitHub label is not authoritative — verify the actual named blocking issues before treating a ticket as blocked (2607-DEV-602's label was stale; #587-592 had all closed 2026-07-23)

## Decisions
DECISION: #602's ICS-description logic (`feed.ics/route.ts`) extracted verbatim into `lib/server/calendar.ts`'s `buildEventDescription()` — additive, behavior-preserving — so the Phase 1c format is snapshot-testable without mocking Clerk/Supabase auth.
DECISION: CodeRabbit's "seed deterministic event data" suggestion for the e2e popup-coverage gap was not implemented (heavy lift, no existing calendar-seed script, out of proportion for a test-coverage ticket); instead the silent `if (count > 0)` skip was converted to a hard `expect(...).toBeVisible()` so an empty month fails loudly instead of silently passing.
DECISION: CodeRabbit's "use the `Personal` locator" finding was rejected as a false positive — `cal.inPerson`/"In-person" and `cal.personal`/"Personal" are two distinct real buttons; the PR's own live-Preview CI run had already passed using the original `'In-person'` locator. Replied on the thread, left unresolved (not applied).

## Facts
- Hosted DEV Supabase project: `iymwxdewcpvpjgzewtzk`, prod: `ynykjpnetfwqzdnsgkkg`
- CI's `Authenticated E2E (Clerk)` job is a ~5s gated skip (missing secrets) — does not run specs; not real coverage. `mobile-390`'s `390px smoke vs preview` job is real, runs against the live Vercel Preview, and did execute `e2e/calendar.spec.ts` (confirmed via job log: "1 [mobile-390] › e2e/calendar.spec.ts:21:7 ... (3.4s)").
- This repo's local sandbox has a reproducible pre-existing Node-fetch flake reaching Supabase from the Next dev server under browser-driven (Playwright) load — confirmed present on a clean `main` checkout too (same failure line, same error), so it's environment-specific, not caused by any #602 change. Plain `curl` against the same route never reproduces it. Do not re-litigate this as a real bug without new evidence; the actual gate is CI/Preview, which passed.
- PR #651: `dev/2607-DEV-602` → `main`, title `[2607-DEV-602] Calendar refactor 6: test coverage (date utils, ICS snapshot, calendar e2e)`, body has `Closes #602`.
- No new routes, no schema/migration changes this ticket.

## Done
#602 PLAN — RESULT: verdict READY; found the `blocked` label stale (dependencies #587-592 all closed).
#602 CLAIM — RESULT: re-entry on existing issue #602 (label removed, Design Checklist completed in the issue body); branch `dev/2607-DEV-602` cut from `main`; `docs/CLAIMS.md` row added (no overlap with #601's then-in-flight row).
#602 BUILD — RESULT: `app/(dashboard)/calendar/utils.test.ts` (new, 15 tests), `lib/format.test.ts` extended (`calMonth`/`calDay`/`formatDateMediumEn`/`formatDateLongEn`), `buildEventDescription()` extracted into `lib/server/calendar.ts` with `lib/server/calendar.test.ts` snapshot coverage, `e2e/calendar.spec.ts` (new, unauthenticated smoke). 51 unit tests / `tsc --noEmit` clean. PR #651 opened ready-for-review; CI green including the real `390px smoke vs preview` job.
#602 GCR — RESULT: CodeRabbit posted 4 findings on commit `0639913`. 3 applied (DST test instants corrected; e2e popup-skip converted to a hard assertion; empty-string `category` handling made consistent with location/meeting_url, +1 new test) in commit `a2ba772`, threads resolved via GraphQL. 1 rejected as a false positive (filter-locator label mix-up), replied on-thread with reasoning, left unresolved.

## Open items
- Get a genuine CodeRabbit re-review on `a2ba772` (last one was rate-limited) before merging PR #651
- #601's post-merge tail (prod smoke-check, `migrate-prod` confirmation) was left unverified in a prior session — flag if prod state comes up again
- Issue #603+ (calendar refactor phases 7-8, if any) — not investigated this session

## Failed attempts
(none this session)
