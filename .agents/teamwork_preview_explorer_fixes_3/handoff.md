# Handoff Report: Analysis and Proposed Edits for Tickets A, B, and C

## 1. Observation
- **Ticket A Target Files:**
  - `.cursor/rules/auth.mdc`: Line 3 uses `globs: ["app/api/**/*.ts", "middleware.ts", "lib/proxy.ts"]`. Lines 10-15 define the hybrid middleware scope, mentioning `middleware.ts` twice.
  - `CLAUDE.md`: Line 74 contains `- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind. CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.`
  - `.cursor/rules/database.mdc`: Line 12 references `20260520_002_rls.sql`. Lines 18-22 contain the SQL definition for `get_my_clerk_id()`, implementing it as `SELECT auth.jwt() ->> 'sub'`.
- **Ticket B Target Files:**
  - `docs/architecture/DECISIONS.md`: Line 20 lists `ADR-009` as `Active`. Lines 288-293 define `ADR-009` detail with `Status: Active`.
  - `docs/ai/GOTCHAS.md`: Active list ends at line 32 with no mention of migration rollback comments.
  - `docs/ai/GEMINI.md`: Line 10 contains `**Workflow:** Every task follows: **SSU → PLAN → CLAIM → BUILD → PIU**.`.
- **Ticket C Target Files:**
  - `scripts/bootstrap.js`: Line 102 creates a readline interface directly under `main()` without checking `process.stdin.isTTY`. Unused `catch (err)` variables are present on lines 56, 74, and 310. The file ends with `main();` call on line 370 with no `.catch()` block.
  - `scripts/check-infra.js`: Line 11 implements `isPathContained(resolvedPath)` using path comparison but without Windows drive letter casing tolerance. Unused `catch (err)` variables are present on lines 55, 75, 109, and 270.
  - `scripts/upgrade-infra.js`: No process signal listeners exist for `SIGINT` or `SIGTERM`. Line 130 defines `askQuestion(query)` using readline directly without guarding for interactive mode/TTY. Line 12 implements `isPathContained` case-sensitively. Unused `catch (err)` variables are present on lines 56, 76, 110, 150, 266, 459, and 499. The file ends with `main();` call on line 504 with no `.catch()` block.

## 2. Logic Chain
- **Ticket A:**
  - `proxy.ts` at the root functions as the single unified middleware in the repository. Changing the glob patterns and removing the references to `middleware.ts` enforces the strict configuration rule (from `CLAUDE.md` constraint).
  - Adding the PLAN mode exception in `CLAUDE.md` aligns it with `docs/ai/PLAN.md`'s allowed writing of `implementation_plan.md`.
  - Supabase's `auth.jwt() ->> 'sub'` claim evaluates to the Supabase Auth UUID, which does not exist/align with Clerk authenticated user IDs (which are stored in `user_id` inside `request.jwt.claims`). Correcting the docs block helper definition prevents incorrect copy-paste RLS policy definitions.
  - The baseline file `20260315000000_baseline.sql` is confirmed to hold the actual definitions of these functions, rather than the non-existent `20260520_002_rls.sql`.
- **Ticket B:**
  - The status of ADR-009 is updated to `Superseded` to match the adoption of quantitative triggers defined in the rules file `RULES.md` and `.cursor/rules/frontend.mdc`.
  - Documenting the rollback requirement in `docs/ai/GOTCHAS.md` ensures compliance with `npm run validate-rules`.
  - Updating GEMINI.md workflow to `GCR` removes obsolete PIU nomenclature.
- **Ticket C:**
  - Interactive prompts hang in non-TTY environments. By checking `process.stdin.isTTY` at execution startup (bootstrap) or step-wise (`askQuestion`), we can abort or safely fallback.
  - Windows paths can differ in casing due to drive letters. Comparing paths case-insensitively when `process.platform === 'win32'` prevents false security traversal warnings.
  - Signal hook listeners `process.on('SIGINT', cleanup)` and `process.on('SIGTERM', cleanup)` ensure intermediate Git clone operations are removed from `.agentic-temp-clone` when interrupted.
  - Modern ES/JS syntax permits omitting the unused parameter of `catch` statement blocks (`try ... catch`). Changing `catch (err)` to `catch` clean-ups unused arguments.

## 3. Caveats
- Windows path comparisons are assumed to behave consistently case-insensitively for the drive letter prefix, which is standard.
- The `isPathContained` fix assumes lowercase mapping is sufficient for casing mismatches (e.g. `C:` vs `c:`).

## 4. Conclusion
- Precise edits have been proposed and compiled for all Ticket A, B, and C targets. These edits ensure the repository config, architecture logs, rule files, and validation/deployment scripts are correct, non-hanging under non-interactive shells, robust on Windows hosts, and clean of unused variables.

## 5. Verification Method
- **Self-Verification:**
  - Inspect the proposed diff blocks in `analysis.md`.
  - Verify that each file block matches lines retrieved via `view_file`.
  - Verify the replacement logic against the files' baseline structure.
