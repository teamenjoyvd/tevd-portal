# docs/guardrails/README.md

Home for the guardrails-kit upgrade log required by `docs/guardrails/_FORMAT.md` F15: every kit-file edit bumps that file's version comment and logs an entry here.

## Upgrade notes

### v1.0 -> v1.0.1 (2026-07-11)

- **File changed:** `docs/guardrails/SESSION.md` — version comment bumped `v1.0` -> `v1.0.1`.
- **What:** added S8 — a silent-`ScheduleWakeup`-re-poll budget (stop after 3 consecutive silent wakeups; geometric backoff past the first). New ID, no renumbering (F12).
- **Why:** a live session ("Fable refactoring and UX improvements") was found looping `ScheduleWakeup` indefinitely at a flat cadence waiting on a deferred human decision, re-entering cold context each cycle with no new signal — pure overhead with no corresponding guardrail rule.
- **Also added this pass (non-kit, no version bump needed):** `docs/CLAIMS.md` (new claim registry) + a `docs/guardrails/PROJECT.md#claim-complete-definition` addition wiring it into CLAIM (PROJECT.md is F15-exempt, project-authored). See `docs/guardrails/MIGRATION-LOG.md`'s "Post-migration kit edit" entry for the full session context.
