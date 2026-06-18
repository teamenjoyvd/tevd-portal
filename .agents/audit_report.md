# Infrastructure Audit Report: tevd-portal

This report presents the findings of the read-only infrastructure audit conducted on the developer rules, workflows, configuration baselines, and scripts in the `tevd-portal` repository. No writes to codebase source files (outside the `.agents/` directory) have been performed.

---

## 1. Baseline Drift Status (R1)

Running the self-check script (`npm run agentic:check`) results in a failure (exit code 1) due to detected baseline drift:

```
🌌 Agentic Infrastructure Self-Check

📊 Project: tevd-portal
📌 Infra Version: 2.0.0 (sha: f3acc1b)

🔍 Scanning tracked files...
─────────────────────────────────────────────────
...
⚠️  [MODIFIED]  scripts/bootstrap.js
⚠️  [MODIFIED]  scripts/check-infra.js
✅ [CLEAN]       scripts/handoff.js
✅ [CLEAN]       scripts/smoke.js
⚠️  [MODIFIED]  scripts/upgrade-infra.js
✅ [CLEAN]       scripts/validate-rules.js
─────────────────────────────────────────────────
📋 Summary:
   Clean: 4  |  Modified: 3  |  Ignored: 18  |  Missing: 0  |  Untracked: 0
```

### Analysis of the Drift
- **Git Status**: Running `git status` reports that there are no modified tracked files in the local workspace.
- **Root Cause**: The source code files on disk match the current Git HEAD commit. However, the MD5 hashes stored in `agentic.config.json` do not match the hashes of these files. The baseline hashes in `agentic.config.json` drifted because past commits modified `bootstrap.js`, `check-infra.js`, and `upgrade-infra.js` without updating the `"hashes"` object.

---

## 2. Analysis of Developer Rules & Gotchas (R2)

### A. Workflow & Hard Constraints Mismatches
*   **Critical Middleware/Auth Bypass**:
    *   `CLAUDE.md` (Line 63), `docs/ai/RULES.md` (Lines 10-11), and `docs/ai/GOTCHAS.md` (Line 7) strictly forbid creating `middleware.ts` in the project root, mandating that edge authentication logic live in `proxy.ts`.
    *   `docs/architecture/DECISIONS.md` claims that Next.js resolves `proxy.ts` as the middleware because it is configured in `next.config.ts`.
    *   **Reality**: Next.js only recognizes files named exactly `middleware.ts` or `middleware.js` (optionally under a `src/` directory) for edge middleware execution. `next.config.ts` has no such redirection configuration (and the Next.js API does not support custom middleware filenames).
    *   **Consequence**: Since `middleware.ts` does not exist and `proxy.ts` is ignored by Next.js, Clerk authentication at the edge is completely deactivated. This represents a critical security bypass.
    *   **Contradiction**: `.cursor/rules/auth.mdc` (Line 12) permits `middleware.ts` exclusively for Clerk's `clerkMiddleware()`. This directly contradicts the markdown-based hard rules.

*   **SSU Command Warm-Up Mismatch**:
    *   `CLAUDE.md` requires agents to run `tool_search` during SSU warm-up.
    *   **Reality**: The agent toolkit does not contain a tool called `tool_search`. This causes agents that strictly follow these instructions to fail or generate errors during SSU execution.

*   **PLAN Phase Contradiction**:
    *   `CLAUDE.md` states that the PLAN stage must perform "zero writes of any kind".
    *   `docs/ai/PLAN.md` allows writing or updating the `implementation_plan.md` artifact in the brain directory.
    *   **Consequence**: Automated validation gates enforcing "no writes in PLAN mode" may block legitimate agent planning.

### B. Syntax & Glob Errors in Cursor Rules
*   **`.cursor/rules/auth.mdc` Glob Error**:
    *   Glob pattern includes `lib/proxy.ts`.
    *   **Reality**: `lib/proxy.ts` does not exist; the proxy is located at `proxy.ts` in the project root.
*   **`.cursor/rules/database.mdc` Reference Error**:
    *   Directs developers to look at `20260520_002_rls.sql` for Pattern A RLS helper functions (`get_my_clerk_id()`, etc.).
    *   **Reality**: No such migration file exists. The helper functions are actually defined in `20260315000000_baseline.sql`.

### C. Redundancy & Conflict Checks
*   **Layout Rules Contradiction**:
    *   ADR-009 ("Active" in `DECISIONS.md`) mandates "No hybrid layouts," forcing two separate layouts for all pages.
    *   Newer guidelines in `RULES.md` and `.cursor/rules/frontend.mdc` state: "Default: Single responsive layout," and reserve dual-layouts only for specific high-complexity widgets (e.g., 5+ column tables, complex drag-and-drop).
*   **Undocumented Migration Constraint**:
    *   `scripts/validate-rules.js` checks that all migrations contain a `-- ROLLBACK:` comment, producing warnings if missing.
    *   **Reality**: This requirement is completely missing from `CLAUDE.md`, `RULES.md`, `GOTCHAS.md`, or `.cursor/rules/database.mdc`, causing developer surprise.
*   **Typo in docs**:
    *   `docs/ai/GEMINI.md` references the pattern `PIU`, which has been renamed to `GCR` in other files (such as `docs/ai/GCR.md` and `CLAUDE.md`).

### D. Tooling Alignment with `package.json`
*   **Tailwind CSS v4 Misconfiguration**:
    *   `package.json` specifies `"tailwindcss": "^4"` and `"@tailwindcss/postcss": "^4.2.1"`.
    *   `tailwind.config.ts` exists at the root, but Tailwind v4 does not read `.config.ts` files automatically without explicit config directives.
    *   `styles/brand-tokens.css` defines custom colors using non-standard variable names (e.g. `--brand-forest: #2d332a;` instead of the Tailwind v4 standard `--color-brand-forest: #2d332a;`).
    *   **Consequence**: Tailwind v4 fails to map these variables to standard utility classes (like `bg-brand-forest`). Developers are forced to use verbose inline styles or arbitrary values (e.g., `bg-[var(--brand-forest)]`), defeating the utility-first paradigm.

---

## 3. Infrastructure Scripts Audit (R3)

### A. Robustness & Error Handling
*   **Unhandled Promise Rejections**:
    *   `scripts/bootstrap.js` calls the asynchronous `main()` function at the top level without a `.catch()` handler. A failure inside `main()` that escapes internal try-catch blocks will cause an unhandled rejection crash.
*   **Temp Directory Leak**:
    *   `scripts/upgrade-infra.js` clones the upstream repository to `.agentic-temp-clone`.
    *   **Reality**: If the script is abruptly stopped by the user (`SIGINT` via Ctrl+C) or terminated by a process signal (`SIGTERM`), the temporary directory `.agentic-temp-clone` is leaked and remains on disk, cluttering the workspace.
*   **Silent File Read Failure**:
    *   `scripts/check-infra.js` catches filesystem errors inside `computeHash` and returns `null` silently. This causes a file to be flagged as `MODIFIED` rather than raising a permission or file read error.

### B. Cross-Platform Compatibility
*   **Windows Drive Letter Casing Bug**:
    *   In `scripts/check-infra.js` and `scripts/upgrade-infra.js`, the `isPathContained` helper verifies that resolved paths start with the repository root:
        ```javascript
        function isPathContained(resolvedPath) {
          const normalizedPath = path.resolve(ROOT, resolvedPath);
          return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
        }
        ```
    *   **Reality**: String `startsWith` checks are case-sensitive. Windows drive letters can resolve with different cases (e.g. `c:\` from execution vs `C:\` from `path.resolve`), causing the containment check to return `false` on safe paths. This produces false-positive path traversal warnings and prematurely crashes the scripts on Windows.

### C. Directory Layout Gaps
*   **Hardcoded Path Conventions in Validator**:
    *   `scripts/validate-rules.js` hardcodes paths to `middleware.ts` and `app` directly under the repository root (`ROOT`).
    *   **Reality**: Next.js projects often place `middleware.ts` and the `app` router folder inside a `src/` folder. The current validator completely bypasses these files in such codebases, leaving a validation coverage gap.

### D. Automation Hangs
*   **Non-interactive Shell Block**:
    *   `scripts/bootstrap.js` and `scripts/upgrade-infra.js` prompt the user for input using a readline interface without verifying if the shell is interactive.
    *   **Reality**: If run in non-interactive CI/CD runners, these prompts will wait forever, causing builds to hang.

---

## 4. Prioritized Recommendations

### 🔴 High Impact (Immediate Action Required)

1.  **Restore Next.js Middleware Route Protection (Clerk)**:
    *   **Action**: Rename root `proxy.ts` to `middleware.ts` so Next.js executes Clerk auth.
    *   **Action**: Revise hard constraints in `CLAUDE.md`, `docs/ai/RULES.md`, and `docs/ai/GOTCHAS.md` to permit a root-level `middleware.ts` containing only `clerkMiddleware()`.
    *   **Action**: Update `.cursor/rules/auth.mdc` globs to correctly reference `middleware.ts` (instead of `lib/proxy.ts`).
2.  **Fix Windows Drive Letter Casing Bug**:
    *   **Action**: Modify `isPathContained` in `scripts/check-infra.js` and `scripts/upgrade-infra.js` to compare case-insensitive drive letters on Windows (or use real paths).
3.  **Ensure Temporary File Cleanup**:
    *   **Action**: Add `process.on('SIGINT', cleanup)` and `process.on('SIGTERM', cleanup)` hooks to `scripts/upgrade-infra.js` to ensure `.agentic-temp-clone` is deleted on premature script exit.
4.  **Support `src/` Folder Structure in Rule Validator**:
    *   **Action**: Update `scripts/validate-rules.js` to dynamically detect and check `src/middleware.ts` and `src/app/` if they exist.
5.  **Fix Tailwind CSS v4 Custom Theme Utility Mapping**:
    *   **Action**: Rename CSS variables in `styles/brand-tokens.css` to use the standard `--color-` prefix (e.g., `--color-brand-forest` instead of `--brand-forest`).
    *   **Action**: Remove the unused `tailwind.config.ts` from root to prevent developer confusion.

### 🟡 Medium Impact (Process & Rule Validation Improvements)

6.  **Avoid CI/CD Hangs on Readline Prompts**:
    *   **Action**: Update `scripts/bootstrap.js` and `scripts/upgrade-infra.js` to check `process.stdin.isTTY` and immediately fail or default-bypass prompts in non-interactive shells.
7.  **Correct Database RLS Helpers Reference**:
    *   **Action**: Update `.cursor/rules/database.mdc` to point to `20260315000000_baseline.sql` instead of the non-existent `20260520_002_rls.sql` migration.
8.  **Resolve Layout Constraint Contradictions**:
    *   **Action**: Update ADR-009 in `docs/architecture/DECISIONS.md` to "Superseded" and link to the newer responsive/dual-layout rules defined in `RULES.md` and `frontend.mdc`.
9.  **Document Rollback Comment Policy**:
    *   **Action**: Document the `-- ROLLBACK:` migration comment requirement in `database.mdc` or `GOTCHAS.md`.
10. **Harden Secret Scanner**:
    *   **Action**: Expand `scripts/validate-rules.js` blocklist to scan client components for `CLERK_SECRET_KEY` and other sensitive environment variables.

### 🟢 Low Impact (Maintenance & Syntax Fixes)

11. **Remove Non-existent SSU Tool Warm-up**:
    *   **Action**: Remove the nonexistent `tool_search` command instructions from SSU section in `CLAUDE.md`.
12. **Clarify Plan Stage Writes**:
    *   **Action**: Update `CLAUDE.md` to clarify that local agent planning writes to `.agents/` are excluded from the "zero writes" constraint.
13. **Handle Script Promise Rejections**:
    *   **Action**: Append a `.catch()` block to the top-level invocation of `main()` in `bootstrap.js` and other scripts.
14. **Fix Nomenclature Typos**:
    *   **Action**: Rename `PIU` to `GCR` in `docs/ai/GEMINI.md` for naming consistency.
