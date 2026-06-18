# Analysis Report — Infrastructure Audit Fixes (Gen 2)

This report details the comparison between the current codebase state and the requirements for Tickets A, B, and C, and provides the complete proposed changes (diffs) to achieve full alignment.

---

## 1. Observation

A direct read of the specified files on disk shows the following:

- **`.cursor/rules/auth.mdc`**: Already aligns with the Ticket A requirement. Glob patterns are `["app/api/**/*.ts", "proxy.ts"]`, root `middleware.ts` is explicitly banned, and `proxy.ts` is designated as the root file for Clerk's `clerkMiddleware()`.
- **`CLAUDE.md`**: Already aligns with the Ticket A requirement. Banning of `middleware.ts` and the PLAN mode Exception for writing `implementation_plan.md` to the brain directory is documented on line 74:
  `PLAN does no writes of any kind (Exception: writing the implementation_plan.md artifact to the brain directory).`
- **`.cursor/rules/database.mdc`**: Does **NOT** align.
  - Line 12 still references the non-existent `20260520_002_rls.sql` instead of `20260315000000_baseline.sql`.
  - Lines 19-21 still define `get_my_clerk_id()` as:
    ```sql
    AS $$ SELECT auth.jwt() ->> 'sub' $$;
    ```
    (Expected: `SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'user_id'` and warning comments).
- **`docs/architecture/DECISIONS.md`**: Already aligns. ADR-009 status is marked as `Superseded` on line 20 and lines 291-292.
- **`docs/ai/GOTCHAS.md`**: Already aligns. Line 33 includes the required migration rollback gotcha:
  `| Migration rollback | Every migration SQL file MUST include a -- ROLLBACK: comment block. Enforced by npm run validate-rules. |`
- **`docs/ai/GEMINI.md`**: Already aligns. Line 10 uses `GCR` instead of `PIU` in the workflow step.
- **`docs/ai/PLAN.md`**: Already aligns. Line 10 correctly specifies the `markdown` language tag on the fenced code block.
- **`.infraignore`**: Already aligns. Line 20 correctly lists `docs/ai/CLAIM.md`.
- **`scripts/bootstrap.js`**: Does **NOT** align.
  - Lacks `process.stdin.isTTY` check at the start of `main()`.
  - Unused `err` is present in catch blocks (e.g. `getGitSha` on line 56).
  - Pre-commit hook installer logic (lines 263-298) does not check for exit statements or prepend the validation command after the shebang.
  - `scanTrackedFiles()` (lines 76-94) does not return a sorted and deduplicated array.
  - Lacks `.catch()` on the top-level `main()` call.
- **`scripts/check-infra.js`**: Does **NOT** align.
  - Lacks the `isPathContained` helper function.
  - Lacks path containment validation checks in the file loop in `main()`.
  - Lacks catch block `err` parameter removal where `err` is unused.
- **`scripts/upgrade-infra.js`**: Does **NOT** align.
  - Lacks `process.on('SIGINT', cleanup)` and `process.on('SIGTERM', cleanup)` event listeners.
  - Lacks `isPathContained` helper function.
  - Lacks path containment validation checks in the file loops.
  - Lacks `process.stdin.isTTY` guard in `askQuestion()` (should default to `'n'`).
  - Lacks catch block `err` parameter removal where `err` is unused.
  - Lacks `.catch()` on the top-level `main()` call.

---

## 2. Logic Chain

1. Files that were modified by the previous worker team were overwritten during a baseline re-sync step where `node scripts/upgrade-infra.js --force` was run.
2. Because the scripts and database rules were not ignored in `.infraignore`, they synced from the upstream central templates and reverted local modifications.
3. Therefore, we must plan the exact changes needed to re-apply all requirements for Ticket A, Ticket B, and Ticket C to these files.
4. For `.cursor/rules/database.mdc`, we must update the baseline SQL helper definition and migration reference.
5. For `scripts/bootstrap.js`, we must add the TTY checks, hook prepending logic, sorted/deduplicated tracked files, and catch blocks.
6. For `scripts/check-infra.js` and `scripts/upgrade-infra.js`, we must implement `isPathContained` (handling Windows drive letters case-insensitively), call it in the file loops, add process hooks, and clean up catches.

---

## 3. Caveats

- We assume no custom hooks exist that would conflict with prepending `node scripts/validate-rules.js` after the shebang (any such code is preserved and executed after our validator).
- The Windows drive letter casing bug is resolved by converting both the normalized absolute path and the root directory to lowercase.

---

## 4. Conclusion & Proposed Diffs

Below are the complete, actionable diffs for the non-compliant files.

### Diff 1: `.cursor/rules/database.mdc`
```diff
diff --git a/.cursor/rules/database.mdc b/.cursor/rules/database.mdc
index 28ab830..e84a2f8 100644
--- a/.cursor/rules/database.mdc
+++ b/.cursor/rules/database.mdc
@@ -10,3 +10,3 @@
 ## RLS Gating and Helpers (Pattern A)
 
-- RLS policies must ONLY reference Pattern A helper functions which live in `20260520_002_rls.sql`:
+- RLS policies must ONLY reference Pattern A helper functions which live in `20260315000000_baseline.sql`:
   - `get_my_clerk_id()` - Returns the Clerk user ID from the JWT sub claim.
@@ -19,3 +19,6 @@
 CREATE OR REPLACE FUNCTION get_my_clerk_id()
 RETURNS text LANGUAGE sql STABLE
-AS $$ SELECT auth.jwt() ->> 'sub' $$;
+AS $$
+  -- DO NOT use auth.jwt() ->> 'sub' — resolves to Supabase Auth UUID, not Clerk user ID.
+  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'user_id'
+$$;
```

### Diff 2: `scripts/bootstrap.js`
```diff
diff --git a/scripts/bootstrap.js b/scripts/bootstrap.js
index c7083fb..d48fa2b 100644
--- a/scripts/bootstrap.js
+++ b/scripts/bootstrap.js
@@ -52,3 +52,3 @@
     return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
       .toString()
       .trim();
-  } catch (err) {
+  } catch {
     return "";
   }
 }
@@ -91,3 +91,3 @@
   }
-  return files;
+  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
 }
@@ -96,2 +96,7 @@
 async function main() {
+  if (!process.stdin.isTTY) {
+    console.error("Error: stdin is not a TTY. Aborting.");
+    process.exit(1);
+  }
+
   const rl = readline.createInterface({
@@ -269,19 +274,34 @@
       try {
         let shouldWrite = true;
         if (fs.existsSync(hookPath)) {
           const existingHook = fs.readFileSync(hookPath, "utf8");
           if (existingHook.includes("node scripts/validate-rules.js")) {
             shouldWrite = false;
             console.log("  ⏱️  Pre-commit hook already installed, skipped.");
             summary.skipped.push(".git/hooks/pre-commit");
           } else {
-            fs.appendFileSync(hookPath, "\nnode scripts/validate-rules.js\n");
-            console.log("  ✅ Pre-commit hook updated (appended rule validator).");
-            summary.created.push(".git/hooks/pre-commit (updated)");
+            const hasExitOrLogic = /\bexit\b/.test(existingHook) ||
+              existingHook.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#")).length > 0;
+            if (hasExitOrLogic) {
+              const lines = existingHook.split(/\r?\n/);
+              let shebangIndex = lines.findIndex(line => line.startsWith("#!"));
+              if (shebangIndex !== -1) {
+                lines.splice(shebangIndex + 1, 0, "node scripts/validate-rules.js");
+              } else {
+                lines.unshift("#!/bin/sh", "node scripts/validate-rules.js");
+              }
+              fs.writeFileSync(hookPath, lines.join("\n"), { encoding: "utf8", mode: 0o755 });
+              console.log("  ✅ Pre-commit hook updated (prepended rule validator after shebang).");
+              summary.created.push(".git/hooks/pre-commit (updated)");
+            } else {
+              fs.appendFileSync(hookPath, "\nnode scripts/validate-rules.js\n");
+              console.log("  ✅ Pre-commit hook updated (appended rule validator).");
+              summary.created.push(".git/hooks/pre-commit (updated)");
+            }
             shouldWrite = false;
           }
         }
         if (shouldWrite) {
           fs.writeFileSync(hookPath, hookContent, { encoding: "utf8", mode: 0o755 });
           console.log("  ✅ Pre-commit hook installed.");
           summary.created.push(".git/hooks/pre-commit");
         }
+        try {
+          fs.chmodSync(hookPath, 0o755);
+        } catch {
+          // Ignore chmod error on systems where it is not supported
+        }
       } catch (err) {
```
And at the bottom of `scripts/bootstrap.js`:
```diff
@@ -335,3 +355,6 @@
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  process.exit(1);
+});
```

### Diff 3: `scripts/check-infra.js`
```diff
diff --git a/scripts/check-infra.js b/scripts/check-infra.js
index fb786be..a928be3 100644
--- a/scripts/check-infra.js
+++ b/scripts/check-infra.js
@@ -9,2 +9,15 @@
 const ROOT = path.resolve(__dirname, "..");
 
+// Path containment helper to reject traversal attempts
+function isPathContained(resolvedPath) {
+  if (resolvedPath.split(path.sep).includes("..") || resolvedPath.split("/").includes("..")) {
+    return false;
+  }
+  let normalizedPath = path.resolve(ROOT, resolvedPath);
+  let rootPath = ROOT;
+  if (process.platform === "win32") {
+    normalizedPath = normalizedPath.toLowerCase();
+    rootPath = rootPath.toLowerCase();
+  }
+  return normalizedPath === rootPath || normalizedPath.startsWith(rootPath + path.sep);
+}
+
 // Tracked directories and root-level files
@@ -48,3 +61,3 @@
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
@@ -67,3 +80,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
@@ -101,3 +114,3 @@
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
   }
@@ -188,2 +201,6 @@
   for (const file of sortedFilePaths) {
+    if (!isPathContained(file)) {
+      console.error(`❌ Security Error: Path traversal detected: ${file}`);
+      process.exit(2);
+    }
     const fullPath = path.join(ROOT, file);
@@ -254,3 +271,3 @@
             } catch (err) {
-            } catch (err) {
+            } catch {
               // Ignore git commit log failure
```

### Diff 4: `scripts/upgrade-infra.js`
```diff
diff --git a/scripts/upgrade-infra.js b/scripts/upgrade-infra.js
index e39dc44..bc43ea7 100644
--- a/scripts/upgrade-infra.js
+++ b/scripts/upgrade-infra.js
@@ -11,2 +11,21 @@
 const TEMP_CLONE_DIR = path.join(ROOT, ".agentic-temp-clone");
 
+// Path containment helper to reject traversal attempts
+function isPathContained(resolvedPath) {
+  if (resolvedPath.split(path.sep).includes("..") || resolvedPath.split("/").includes("..")) {
+    return false;
+  }
+  let normalizedPath = path.resolve(ROOT, resolvedPath);
+  let rootPath = ROOT;
+  if (process.platform === "win32") {
+    normalizedPath = normalizedPath.toLowerCase();
+    rootPath = rootPath.toLowerCase();
+  }
+  return normalizedPath === rootPath || normalizedPath.startsWith(rootPath + path.sep);
+}
+
+process.on("SIGINT", () => {
+  cleanup();
+  process.exit(1);
+});
+process.on("SIGTERM", () => {
+  cleanup();
+  process.exit(1);
+});
+
 // Tracked directories and root-level files
@@ -48,3 +67,3 @@
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
@@ -68,3 +87,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
@@ -101,3 +120,3 @@
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
   }
@@ -118,2 +137,5 @@
 function askQuestion(query) {
+  if (!process.stdin.isTTY) {
+    return Promise.resolve("n");
+  }
   const rl = readline.createInterface({
@@ -137,3 +159,3 @@
     return status.length > 0;
-  } catch (err) {
+  } catch {
     // If not a git repo or git not found, treat as clean/ignored
@@ -247,3 +269,3 @@
     } catch (err) {
-    } catch (err) {
+    } catch {
       // Ignore SHA read error
@@ -267,2 +289,6 @@
     for (const file of sortedFiles) {
+      if (!isPathContained(file)) {
+        console.error(`❌ Security Error: Path traversal detected: ${file}`);
+        cleanup();
+        process.exit(2);
       }
       const centralFilePath = path.join(TEMP_CLONE_DIR, file);
@@ -400,2 +426,6 @@
       for (const file of localTrackedFiles) {
+        if (!isPathContained(file)) {
+          console.error(`❌ Security Error: Path traversal detected in local file check: ${file}`);
+          cleanup();
+          process.exit(2);
+        }
         if (isIgnored(file, ignoreList)) continue;
@@ -429,3 +459,3 @@
       } catch (e) {
-        // Fallback to env
+      } catch {
         // Fallback to env
@@ -469,3 +499,3 @@
   } catch (err) {
-  } catch (err) {
+  } catch {
     // Ignore cleanup error
@@ -474,2 +504,6 @@
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  cleanup();
+  process.exit(2);
+});
```

---

## 5. Verification Method

To independently verify the implementation plan, the following should be carried out after applying the diffs:

1. **Rule Validator Verification**:
   ```bash
   npm run validate-rules
   ```
   (Should execute successfully without warnings).
2. **Build and Code Integrity**:
   ```bash
   npm run check-types
   npm run lint
   npm run build
   ```
   (All must compile and build cleanly).
3. **Infrastructure Checker Verification**:
   ```bash
   npm run agentic:check
   ```
   (Should complete cleanly, indicating no unignored drift once baseline hashes are updated with `npm run agentic:bootstrap`).
4. **TTY Guards verification**:
   - Running `echo "y" | node scripts/bootstrap.js` in a non-interactive shell must immediately exit with code 1 instead of hanging.
   - Running `echo "y" | node scripts/upgrade-infra.js` in a non-interactive shell must resolve readline inputs to `'n'` and exit gracefully.
5. **Path Traversal checks**:
   - Manually inject a drift pattern like `{"../../etc/passwd": "somehash"}` under the `agentic.hashes` key inside `agentic.config.json`.
   - Run `npm run agentic:check`. The execution must reject and exit with a security error rather than attempting to check for or read `../../etc/passwd`.
