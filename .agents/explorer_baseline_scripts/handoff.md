# Handoff Report: Milestone 1 - Baseline & Scripts Audit

## 1. Observation

### Command Executed: `npm run agentic:check`
- **Working Directory**: `c:\Users\fefence\Downloads\react\teamenjoyvd\tevd-portal`
- **Result Code**: `1` (Failed)
- **Verbatim Output**:
```
> tevd-portal@0.1.0 agentic:check
> node scripts/check-infra.js


🌌 Agentic Infrastructure Self-Check

📊 Project: tevd-portal
📌 Infra Version: 2.0.0 (sha: f3acc1b)

🔍 Scanning tracked files...
─────────────────────────────────────────────────
🛡️ [IGNORED]   .cursor/rules/auth.mdc
✅ [CLEAN]       .cursor/rules/database.mdc
🛡️ [IGNORED]   .cursor/rules/frontend.mdc
🛡️ [IGNORED]   CLAUDE.md
🛡️ [IGNORED]   docs/ai/BUILD.md
🛡️ [IGNORED]   docs/ai/CLAIM.md
🛡️ [IGNORED]   docs/ai/CONTEXT.md
🛡️ [IGNORED]   docs/ai/GCR.md
🛡️ [IGNORED]   docs/ai/GEMINI.md
🛡️ [IGNORED]   docs/ai/GOTCHAS.md
🛡️ [IGNORED]   docs/ai/LOOKUP.md
🛡️ [IGNORED]   docs/ai/PLAN.md
🛡️ [IGNORED]   docs/ai/REF.md
🛡️ [IGNORED]   docs/ai/REFACTOR.md
🛡️ [IGNORED]   docs/ai/RULES.md
🛡️ [IGNORED]   docs/ai/archive/CONTEXT.md
🛡️ [IGNORED]   docs/ai/archive/LOOKUP.md
🛡️ [IGNORED]   docs/ai/archive/REFACTOR.md
🛡️ [IGNORED]   docs/ai/system-prompt.xml
⚠️  [MODIFIED]  scripts/bootstrap.js
⚠️  [MODIFIED]  scripts/check-infra.js
✅ [CLEAN]       scripts/handoff.js
✅ [CLEAN]       scripts/smoke.js
⚠️  [MODIFIED]  scripts/upgrade-infra.js
✅ [CLEAN]       scripts/validate-rules.js
─────────────────────────────────────────────────
📋 Summary:
   Clean: 4  |  Modified: 3  |  Ignored: 18  |  Missing: 0  |  Untracked: 0

💡 Run with --diff to see exact changes on modified files.
```

### Git Status Observation
- **Command Executed**: `git status`
- **Output**:
```
On branch ci-gate-setup
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.agents/
	ORIGINAL_REQUEST.md
	PROJECT.md

nothing added to commit but untracked files present (use "git add" to track)
```
- **Interpretation**: No modified files on disk relative to git HEAD. The scripts `bootstrap.js`, `check-infra.js`, and `upgrade-infra.js` match git HEAD, but do not match the MD5 hashes recorded in `agentic.config.json` (baseline drift).

---

## 2. Logic Chain

1. **Self-Check Failure**:
   - `npm run agentic:check` scans the directories `.cursor/rules`, `scripts`, and `docs/ai` to check for baseline differences between hashes on disk and those stored in `agentic.config.json`.
   - The command reports that `scripts/bootstrap.js`, `scripts/check-infra.js`, and `scripts/upgrade-infra.js` are `MODIFIED`.
   - The exit code of `agentic:check` is `1` because `driftDetected = (modifiedCount > 0 ...)` is true (defined in `check-infra.js:291`).

2. **Baseline Drift Cause**:
   - Since `git status` reports that there are no modified files in the working directory (excluding untracked files), the actual source code files on disk are exactly matching the files in the Git index (HEAD commit).
   - Therefore, the baseline drift is due to the files having been modified in a past commit (or locally before staging/commit) without updates being synchronized (pinned) back to the `"hashes"` object inside `agentic.config.json`.

3. **Code Audits & Rationale**:
   - **Windows Path Casing**:
     - *Observation*: `check-infra.js:12` and `upgrade-infra.js:12` implement `isPathContained(resolvedPath)` using `normalizedPath.startsWith(ROOT + path.sep)`.
     - *Logic*: Because string operations (`startsWith`) in JavaScript are case-sensitive, and Windows drive letter casing can vary dynamically (e.g. `c:\` from raw node execution vs `C:\` from a clean path resolution), a casing difference in the drive letter will cause `isPathContained` to return `false`. This directly leads to false positive "Path traversal attempt detected" errors and premature scripts crash.
   - **Missing Cleanup of Temp files**:
     - *Observation*: `upgrade-infra.js:18` clones the upstream repository into `.agentic-temp-clone`. It calls `cleanup()` in a `finally` block or on handled exceptions.
     - *Logic*: If the user issues a `SIGINT` (Ctrl+C) command to terminate the script, or if the process exits abruptly due to environment crashes, there is no signal handler (`process.on('SIGINT')`) to clean up the cloned directory. Hence, the directory remains on disk, causing untracked files/clutter.
   - **Next.js Assumptions on Directory Layout**:
     - *Observation*: `validate-rules.js` checks `path.join(ROOT, "middleware.ts")` (Line 69) and `path.join(ROOT, "app")` (Line 108).
     - *Logic*: Next.js standard conventions allow placing both `middleware.ts` and `app/` inside a `src/` folder (e.g., `src/middleware.ts` and `src/app/`). Hardcoding the root directory paths means the validator will silently skip these checks on any codebase utilizing the `src/` folder structure, creating a major security/compliance validation gap.

---

## 3. Caveats
- Checked and confirmed that `middleware.ts` is currently missing in the project root, which explains why Check 1 outputted "middleware.ts not found".
- Did not modify any code in the codebase since the task is strictly a read-only investigation.
- Assumptions: Assumed that the developer intends to fix the baseline drift by syncing hashes using the `upgrade-infra` script (with proper config pins) or manually updating `agentic.config.json`.

---

## 4. Conclusion & Audit Findings

### Detailed Script Audits

#### A. `scripts/bootstrap.js`
- **Unawaited Promise/Unhandled Rejection**:
  - **Location**: Line 370
  - **Snippet**:
    ```javascript
    main();
    ```
  - **Issue**: `main()` is an `async` function. In Node.js, calling it without a `.catch()` block leaves the process vulnerable to unhandled promise rejections if any async error escapes the internal try-catch.
  - **Recommendation (Low)**: Change to `main().catch(err => { console.error(err); process.exit(1); });`.
- **Non-Interactive Hang**:
  - **Location**: Lines 13-17 & 102-105
  - **Issue**: Readline interface is created without checking if stdin is a TTY. In automated environments (e.g. CI/CD), the script will hang indefinitely waiting for input.
  - **Recommendation (Medium)**: Check `process.stdin.isTTY` or add automated timeout fallbacks.
- **No Rejection path in `ask` helper**:
  - **Location**: Lines 13-17
  - **Issue**: If stdin is closed prematurely, the Promise returned by `ask` will remain pending forever, leaking memory and preventing script termination.

#### B. `scripts/check-infra.js`
- **Windows Drive Letter Casing Defect**:
  - **Location**: Lines 11-14
  - **Snippet**:
    ```javascript
    function isPathContained(resolvedPath) {
      const normalizedPath = path.resolve(ROOT, resolvedPath);
      return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
    }
    ```
  - **Issue**: `startsWith` is case-sensitive. If `ROOT` resolves with `c:` and `resolvedPath` with `C:`, it fails. This triggers the path traversal alarm (Line 201) and aborts execution.
  - **Recommendation (High)**: Resolve the realpath using `fs.realpathSync.native` or compare lowercase equivalents on Windows.
- **Silent Failure in `computeHash`**:
  - **Location**: Lines 50-57
  - **Issue**: If `fs.readFileSync` fails due to permissions, it returns `null` silently, resulting in the file being flagged as `MODIFIED` instead of raising a read/permission error.
  - **Recommendation (Medium)**: Log a warning or throw a descriptive error when reads fail on existing files.

#### C. `scripts/upgrade-infra.js`
- **Windows Drive Letter Casing Defect**:
  - **Location**: Lines 12-15
  - **Issue**: Identical to `check-infra.js`. Mismatched drive letter casing will cause false-positive path traversal errors and abort the upgrade.
  - **Recommendation (High)**: Apply the same normalization fix.
- **No Cleanup of Temp Directory on Interruption**:
  - **Location**: Lines 18, 230-248, 494-502
  - **Issue**: If the upgrade is terminated (via `SIGINT` / Ctrl+C), `.agentic-temp-clone` remains on disk. No process handlers clean it up.
  - **Recommendation (High)**: Add `process.on('SIGINT', cleanup)` and `process.on('SIGTERM', cleanup)` handlers to ensure resource cleanup.
- **Non-Interactive Hangs**:
  - **Location**: Line 361
  - **Issue**: Prompts operator to overwrite changes without verifying TTY, risking hangs in non-interactive CI environments.
  - **Recommendation (Medium)**: Automatically abort or fail when running in CI without proper flags.

#### D. `scripts/validate-rules.js`
- **Hardcoded Directories (Next.js conventions)**:
  - **Location**: Lines 69, 108
  - **Snippet**:
    ```javascript
    const mwPath = path.join(ROOT, "middleware.ts");
    const appDir = path.join(ROOT, "app");
    ```
  - **Issue**: Fails to detect `middleware.ts` or scan `app/` components if placed inside a `src/` directory.
  - **Recommendation (High)**: Fallback or search in both `ROOT` and `path.join(ROOT, "src")`.
- **Incomplete / Naive Secret Scanner**:
  - **Location**: Lines 124-135
  - **Issue**: Only checks files containing exact `"use client"` strings, and only scans for the keyword `SUPABASE_SERVICE_ROLE_KEY`. Misses other secrets (e.g. `CLERK_SECRET_KEY`) and transitive imports.
  - **Recommendation (Medium)**: Expand scan keyword list and match the directive using a more flexible regex.

---

### Consolidated Recommendations

| Severity | Script | Vulnerability | Proposed Fix / Action |
| --- | --- | --- | --- |
| **High** | `check-infra.js`, `upgrade-infra.js` | Windows Drive Letter Casing Bug | Normalize `ROOT` and resolved paths using lowercase drive letters or real paths on Windows. |
| **High** | `upgrade-infra.js` | Temp Directory Leak | Register `process.on('SIGINT')` and other signals to execute `cleanup()`. |
| **High** | `validate-rules.js` | Hardcoded Directory Assumptions | Search for Next.js directories in both root and `src/` folder to ensure complete rule coverage. |
| **Medium**| `bootstrap.js`, `upgrade-infra.js` | TTY Hangs in CI/CD | Check `process.stdin.isTTY` and raise errors instead of hanging indefinitely. |
| **Medium**| `validate-rules.js` | Naive Secret Scanner | Add `CLERK_SECRET_KEY` and other sensitive markers to the block list. Use regular expressions for `use client`. |
| **Medium**| `check-infra.js` | Silent file read failures | Raise a warning when `fs.readFileSync` throws an error instead of silently mapping it to `null`. |
| **Low**  | `bootstrap.js`, `upgrade-infra.js` | Unhandled Promise Rejections | Append `.catch()` handler to the top-level `main()` calls. |

---

## 5. Verification Method

To verify these findings and the current project state:
1. **Run the baseline self-check**:
   ```powershell
   npm run agentic:check
   ```
   *Expected outcome*: Exit code 1 with three modified files (`scripts/bootstrap.js`, `scripts/check-infra.js`, and `scripts/upgrade-infra.js`).
2. **Inspect configuration**:
   Open `agentic.config.json` and compare the hashes in `"hashes"` block with the actual file states.
3. **Verify Windows Casing Issue**:
   Run `node scripts/check-infra.js` in environments resolving path drives with different case letters.
