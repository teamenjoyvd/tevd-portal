# Handoff Report — Explorer Fixes Gen 2

## 1. Observation
- By inspecting the target files, we observed:
  - `CLAUDE.md` line 74 contains: `Exception: writing the implementation_plan.md artifact to the brain directory` indicating it has successfully preserved this ticket requirement.
  - `.cursor/rules/auth.mdc` line 3 contains `globs: ["app/api/**/*.ts", "proxy.ts"]` and lines 12-14 contain `- Clerk's clerkMiddleware() lives in proxy.ts...` showing it is in the correct status.
  - `.cursor/rules/database.mdc` line 12 contains `- RLS policies must ONLY reference Pattern A helper functions which live in 20260520_002_rls.sql:` and lines 19-21 contain `AS $$ SELECT auth.jwt() ->> 'sub' $$;` indicating it is incorrect/overwritten.
  - `docs/architecture/DECISIONS.md` line 20 and line 291 status is `Superseded`, with the note added at line 292.
  - `docs/ai/GOTCHAS.md` line 33 contains `| Migration rollback | Every migration SQL file MUST include a -- ROLLBACK: comment block. Enforced by npm run validate-rules. |`.
  - `docs/ai/GEMINI.md` line 10 contains `Every task follows: SSU → PLAN → CLAIM → BUILD → GCR.`
  - `docs/ai/PLAN.md` line 11 contains `markdown` language tag.
  - `.infraignore` line 20 contains `docs/ai/CLAIM.md`.
  - `scripts/bootstrap.js` contains no `isTTY` check at the start of `main()` (line 97), no `.catch()` block (line 337), and scanTrackedFiles returns `files` without sort/dedup (line 93).
  - `scripts/check-infra.js` and `scripts/upgrade-infra.js` contain no path containment security checks or Windows casing workarounds (they were wiped out).
  - `scripts/upgrade-infra.js` contains no signal hooks or TTY guards inside `askQuestion()`.

## 2. Logic Chain
1. We checked the list of ignored files in `.infraignore` and matched them against the files that were preserved (`CLAUDE.md`, `.cursor/rules/auth.mdc`, `docs/ai/PLAN.md`, `docs/ai/GOTCHAS.md`, `docs/ai/GEMINI.md`). These match because they were explicitly ignored during upstream upgrade/sync.
2. The remaining files (`.cursor/rules/database.mdc`, `scripts/bootstrap.js`, `scripts/check-infra.js`, `scripts/upgrade-infra.js`) were not ignored, and running `node scripts/upgrade-infra.js --force` pulled upstream templates and overwrote them.
3. Therefore, we must plan diffs that apply the required modifications to the overwritten files.
4. For `.cursor/rules/database.mdc`, we update the helper definition block to query `current_setting('request.jwt.claims', true)` and reference `20260315000000_baseline.sql`.
5. For `scripts/bootstrap.js`, we insert the TTY guard inside `main()`, use parameterless `catch` blocks where `err` is unused, sort/dedup in `scanTrackedFiles()`, append `.catch()` at top-level `main()`, and logic-guard pre-commit updates to prepend right after shebang if exit/other logic exists.
6. For `scripts/check-infra.js` and `scripts/upgrade-infra.js`, we implement a robust `isPathContained()` function checking for both `..` elements and Windows-specific lowercase drive letter logic. We hook this checker to all recursive searches, hash queries, configuration parsers, and file read/write/delete loops, terminating processes immediately if any path containment violation occurs. We also hook signal listener hooks (`SIGINT` and `SIGTERM`) to trigger temp clone directory cleanups, and abort `askQuestion` readline prompts to default to `'n'` if stdin TTY is absent in non-interactive environments.

## 3. Caveats
- No code was written to source files (this is a read-only analysis phase).
- Assumed standard Node.js runtime environment for shell checks (Tty status checked via `process.stdin.isTTY`).

## 4. Conclusion
- Proposed code diffs have been successfully formulated for the 4 drift/overwritten files (`database.mdc`, `bootstrap.js`, `check-infra.js`, `upgrade-infra.js`). The remaining 7 files are in correct states and require no changes.
- The analysis and planned changes are fully documented in `analysis.md`.

## 5. Verification Method
- Perform the following checks to verify:
  1. Inspect `.cursor/rules/database.mdc` to verify that `20260315000000_baseline.sql` and `current_setting('request.jwt.claims')` are references in the SQL helper docs block.
  2. Inspect `scripts/bootstrap.js` to ensure `process.stdin.isTTY` check exists at the very start of `main()`, `scanTrackedFiles()` sorts and dedupes the returned array, pre-commit prepends rules validation, and `main().catch(...)` exists at the bottom.
  3. Inspect `scripts/check-infra.js` and `scripts/upgrade-infra.js` to ensure the `isPathContained()` helper handles Windows drive casing lowercase and rejects `..`, and that path validation is run on all file operations.
  4. Verify that signal listeners and interactive readline tty-fallback checks exist in `upgrade-infra.js`.
