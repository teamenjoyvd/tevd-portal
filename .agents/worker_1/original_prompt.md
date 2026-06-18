## 2026-06-05T17:09:20Z

You are a worker agent. Your mission is to implement PR #446 fixes per the codebase security analyst's recommendations and verify them.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope of changes:
1. File: `scripts/check-infra.js`
- Implement `isPathContained(resolvedPath)` immediately under `const ROOT`:
  ```javascript
  function isPathContained(resolvedPath) {
    const normalizedPath = path.resolve(ROOT, resolvedPath);
    return normalizedPath.startsWith(ROOT + path.sep);
  }
  ```
- Add path containment check to `computeHash(filePath)` and `getFilesRecursive(dir)`.
- In `main()` loop, reject any paths that contain `..` or attempt to escape the repository root:
  ```javascript
  for (const file of sortedFilePaths) {
    const fullPath = path.join(ROOT, file);
    if (file.includes("..") || !isPathContained(fullPath)) {
      console.error(`❌ Error: Path traversal attempt detected: ${file}`);
      process.exit(2);
    }
  ```

2. File: `scripts/upgrade-infra.js`
- Implement `isPathContained(resolvedPath)` immediately under `const ROOT`:
  ```javascript
  function isPathContained(resolvedPath) {
    const normalizedPath = path.resolve(ROOT, resolvedPath);
    return normalizedPath.startsWith(ROOT + path.sep);
  }
  ```
- Add path containment check to `computeHash(filePath)` and `getFilesRecursive(dir)`.
- In `ensureDir(dirPath)`, check:
  ```javascript
  if (!isPathContained(dirPath)) {
    throw new Error(`Path containment violation: Directory target is outside root: ${dirPath}`);
  }
  ```
- In `main()` loop, validate paths for all upgrade actions:
  ```javascript
  for (const file of sortedFiles) {
    const centralFilePath = path.join(TEMP_CLONE_DIR, file);
    const localFilePath = path.join(ROOT, file);

    if (file.includes("..") || !isPathContained(localFilePath) || !isPathContained(centralFilePath)) {
      console.error(`❌ Error: Path traversal attempt detected: ${file}`);
      cleanup();
      process.exit(2);
    }
  ```

3. File: `scripts/bootstrap.js`
- Update pre-commit hook installation step (lines 268-307) so that:
  - If an existing hook file is found at `.git/hooks/pre-commit`, read its content.
  - If it contains exit statements or other logic (defined as lines that are not empty, comments, or shebang lines), prepend the validation command (`node scripts/validate-rules.js`) right after the shebang line (`#!/bin/sh` or similar) so it runs before any other hook code exits. Otherwise, write/append it.
- Update `scanTrackedFiles()` to deduplicate and return a sorted array using `[...new Set(files)].sort((a, b) => a.localeCompare(b))` to ensure stable baseline hashes across environments.

4. File: `docs/ai/PLAN.md`
- Add the `markdown` language tag to the fenced code block inside `docs/ai/PLAN.md` around lines 11-15 (it is currently starting with `   ``` ` and should be `   ```markdown`).

5. File: `.infraignore` at root of the repository
- If it does not exist, create it.
- Append `docs/ai/CLAIM.md` on a new line.

Verification tasks:
1. Run local ESLint check (`npm run lint`), Type Check (`npm run check-types`), and Next.js Build (`npm run build`).
2. Run `npm run agentic:check` to ensure the self-check tool passes or reports appropriate drift.
3. Write a report detailing all files modified, full git diff of changes, and execution logs of all verification commands.
4. Report back when completed.
