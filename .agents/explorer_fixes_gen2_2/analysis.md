# Analysis and Proposed Edits for Tickets A, B, and C

This analysis report summarizes the differences between the current codebase state and the requirements for Tickets A, B, and C, and provides the complete, proposed diffs for each file.

---

## Analysis of Differences & Baseline Regressions

Following an audit by the Victory Auditor, it was discovered that a previous implementation of Ticket A, B, and C fixes was reverted during a baseline re-sync step. Specifically, running `node scripts/upgrade-infra.js --force` pulled the templates from the central repository and overwrote local files because they were not protected or lacked upstream implementations. Consequently, several critical security features (such as path traversal checks in `check-infra.js` and `upgrade-infra.js`) and rule updates were lost. 

Below is the verification of the current codebase state vs. requirements:

### Ticket A: Clerk Auth & Rules Alignment
1. **`.cursor/rules/auth.mdc`**: **Aligned**. The file correctly has `globs: ["app/api/**/*.ts", "proxy.ts"]` and specifies that `clerkMiddleware()` lives in `proxy.ts`. No changes needed.
2. **`CLAUDE.md`**: **Aligned**. The exception for writing the `implementation_plan.md` artifact to the brain directory is already documented under Hard Constraints. No changes needed.
3. **`.cursor/rules/database.mdc` (SQL Helper)**: **Drifted / Reverted**. The helper function `get_my_clerk_id()` still references the insecure/incorrect `auth.jwt() ->> 'sub'` logic instead of reading from `request.jwt.claims`. Needs correction.

### Ticket B: Docs & Architecture Fixes
1. **`.cursor/rules/database.mdc` (Reference)**: **Drifted / Reverted**. The migration reference for RLS helpers points to the non-existent `20260520_002_rls.sql` instead of `20260315000000_baseline.sql`. Needs correction.
2. **`docs/architecture/DECISIONS.md`**: **Aligned**. ADR-009 is already marked as `Superseded`. No changes needed.
3. **`docs/ai/GOTCHAS.md`**: **Aligned**. The rollback comment constraint is already documented in the Gotchas table. No changes needed.
4. **`docs/ai/GEMINI.md`**: **Aligned**. Stale nomenclature `PIU` is replaced with `GCR` on line 10. No changes needed.
5. **`docs/ai/PLAN.md`**: **Aligned**. Markdown language tags are correctly applied. No changes needed.
6. **`.infraignore`**: **Aligned**. `docs/ai/CLAIM.md` is present in the ignore list. No changes needed.

### Ticket C: Infrastructure Scripts Hardening
1. **`scripts/bootstrap.js`**: **Drifted / Reverted**. Lacks `process.stdin.isTTY` check at the start of `main()`, has unused `err` in `catch` blocks, lacks a `.catch()` block on the top-level call, lacks pre-commit prepending logic right after the shebang, and lacks sorted/deduplicated tracked files scanning. Needs remediation.
2. **`scripts/check-infra.js`**: **Drifted / Reverted**. Path traversal checks (`isPathContained`) have been completely deleted. Unused `err` variables remain in `catch` blocks. Needs remediation.
3. **`scripts/upgrade-infra.js`**: **Drifted / Reverted**. Lacks signal handlers (SIGINT/SIGTERM), path containment checks (`isPathContained`), non-interactive terminal guards for readline in `askQuestion`, and unused `err` in `catch` blocks are still present. Needs remediation.

---

## Proposed Complete Diffs

Below are the complete, drop-in replacement diffs for the affected files on disk.

### 1. `.cursor/rules/database.mdc`
```diff
diff --git a/.cursor/rules/database.mdc b/.cursor/rules/database.mdc
index b0068a0..f29c4ba 100644
--- a/.cursor/rules/database.mdc
+++ b/.cursor/rules/database.mdc
@@ -10,3 +10,3 @@
 ## RLS Gating and Helpers (Pattern A)
 
-- RLS policies must ONLY reference Pattern A helper functions which live in `20260520_002_rls.sql`:
+- RLS policies must ONLY reference Pattern A helper functions which live in `20260315000000_baseline.sql`:
   - `get_my_clerk_id()` - Returns the Clerk user ID from the JWT sub claim.
@@ -18,4 +18,6 @@
 ### Helper Definitions
 ```sql
 CREATE OR REPLACE FUNCTION get_my_clerk_id()
 RETURNS text LANGUAGE sql STABLE
-AS $$ SELECT auth.jwt() ->> 'sub' $$;
+AS $$
+  -- DO NOT use auth.jwt() ->> 'sub' — resolves to Supabase Auth UUID, not Clerk user ID
+  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'user_id'
+$$;
```

---

### 2. `scripts/bootstrap.js`
```diff
diff --git a/scripts/bootstrap.js b/scripts/bootstrap.js
index ee90c42..9d070b4 100644
--- a/scripts/bootstrap.js
+++ b/scripts/bootstrap.js
@@ -53,3 +53,3 @@ function getGitSha() {
     return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
       .toString()
       .trim();
-  } catch (err) {
+  } catch {
     return "";
   }
 }
@@ -91,3 +91,3 @@ function scanTrackedFiles() {
     }
   }
-  return files;
+  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
 }
 
 // ── Main ─────────────────────────────────────────────────────────────
 async function main() {
+  if (!process.stdin.isTTY) {
+    console.error("Error: Input is not interactive (process.stdin.isTTY is false). Aborting.");
+    process.exit(1);
+  }
+
   const rl = readline.createInterface({
@@ -274,10 +279,21 @@ async function main() {
             shouldWrite = false;
             console.log("  ⏱️  Pre-commit hook already installed, skipped.");
             summary.skipped.push(".git/hooks/pre-commit");
           } else {
-            fs.appendFileSync(hookPath, "\nnode scripts/validate-rules.js\n");
-            console.log("  ✅ Pre-commit hook updated (appended rule validator).");
-            summary.created.push(".git/hooks/pre-commit (updated)");
-            shouldWrite = false;
+            const hasExit = /\bexit\b/.test(existingHook);
+            const lines = existingHook.split(/\r?\n/);
+            const hasShebang = lines[0] && lines[0].startsWith("#!");
+            const hasOtherLogic = lines.some((line, index) => {
+              if (index === 0 && hasShebang) return false;
+              const trimmed = line.trim();
+              return trimmed.length > 0 && !trimmed.startsWith("#");
+            });
+            if (hasExit || hasOtherLogic) {
+              const command = "node scripts/validate-rules.js\n";
+              const newContent = hasShebang
+                ? [lines[0], command + lines.slice(1).join("\n")].join("\n")
+                : command + existingHook;
+              fs.writeFileSync(hookPath, newContent, { encoding: "utf8", mode: 0o755 });
+              console.log("  ✅ Pre-commit hook updated (prepended rule validator after shebang).");
+              summary.created.push(".git/hooks/pre-commit (updated)");
+              shouldWrite = false;
+            } else {
+              fs.appendFileSync(hookPath, "\nnode scripts/validate-rules.js\n");
+              console.log("  ✅ Pre-commit hook updated (appended rule validator).");
+              summary.created.push(".git/hooks/pre-commit (updated)");
+              shouldWrite = false;
+            }
           }
         }
@@ -308,3 +324,3 @@ async function main() {
             try {
               fs.chmodSync(hookPath, 0o755);
-            } catch (err) {
-              // Ignore chmod error on systems where it is not supported
+            } catch {
+              // Ignore chmod error on systems where it is not supported
             }
@@ -335,3 +351,6 @@ async function main() {
 }
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  process.exit(1);
+});
```

---

### 3. `scripts/check-infra.js`
```diff
diff --git a/scripts/check-infra.js b/scripts/check-infra.js
index d93cf0b..dbe293b 100644
--- a/scripts/check-infra.js
+++ b/scripts/check-infra.js
@@ -9,4 +9,16 @@ const { execSync } = require("child_process");
 const ROOT = path.resolve(__dirname, "..");
 
+function isPathContained(resolvedPath) {
+  if (resolvedPath.split(path.sep).includes("..") || resolvedPath.split("/").includes("..") || resolvedPath.split("\\").includes("..")) {
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
 const TRACKED_DIRS = [".cursor/rules", "scripts", "docs/ai"];
@@ -41,4 +53,5 @@ function printHelp() {
 function computeHash(filePath) {
+  if (!isPathContained(filePath)) return null;
   if (!fs.existsSync(filePath)) return null;
   try {
     const content = fs.readFileSync(filePath);
     // Normalize line endings to LF to ensure cross-platform hash stability
     const normalized = content.toString("utf8").replace(/\r\n/g, "\n");
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
 }
@@ -55,4 +68,5 @@ function computeHash(filePath) {
 function getFilesRecursive(dir) {
+  if (!isPathContained(dir)) return [];
   if (!fs.existsSync(dir)) return [];
   let files = [];
   try {
@@ -67,3 +81,3 @@ function getFilesRecursive(dir) {
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
   }
@@ -101,3 +115,3 @@ function loadInfraIgnore() {
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
   }
@@ -188,4 +202,8 @@ function main() {
   for (const file of sortedFilePaths) {
+    if (file.includes("..") || !isPathContained(file)) {
+      console.error(`❌ Error: Path traversal attempt detected: ${file}`);
+      process.exit(2);
+    }
     const fullPath = path.join(ROOT, file);
     const hasBaseline = baselineHashes.hasOwnProperty(file);
     const existsOnDisk = fs.existsSync(fullPath);
@@ -255,3 +273,3 @@ function main() {
               }
-            } catch (err) {
+            } catch {
               // Ignore git commit log failure
```

---

### 4. `scripts/upgrade-infra.js`
```diff
diff --git a/scripts/upgrade-infra.js b/scripts/upgrade-infra.js
index 964c331..31070fc 100644
--- a/scripts/upgrade-infra.js
+++ b/scripts/upgrade-infra.js
@@ -11,2 +11,21 @@ const { execSync } = require("child_process");
 const ROOT = path.resolve(__dirname, "..");
 const TEMP_CLONE_DIR = path.join(ROOT, ".agentic-temp-clone");
 
+function isPathContained(resolvedPath) {
+  if (resolvedPath.split(path.sep).includes("..") || resolvedPath.split("/").includes("..") || resolvedPath.split("\\").includes("..")) {
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
@@ -41,4 +60,5 @@ function printHelp() {
 function computeHash(filePath) {
+  if (!isPathContained(filePath)) return null;
   if (!fs.existsSync(filePath)) return null;
   try {
     const content = fs.readFileSync(filePath);
@@ -50,3 +70,3 @@ function computeHash(filePath) {
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
@@ -55,4 +75,5 @@ function computeHash(filePath) {
 function getFilesRecursive(dir) {
+  if (!isPathContained(dir)) return [];
   if (!fs.existsSync(dir)) return [];
   let files = [];
   try {
@@ -67,3 +88,3 @@ function getFilesRecursive(dir) {
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
   }
@@ -101,3 +122,3 @@ function loadInfraIgnore() {
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
   }
@@ -118,2 +139,5 @@ function loadInfraIgnore() {
 function askQuestion(query) {
+  if (!process.stdin.isTTY) {
+    return Promise.resolve("n");
+  }
   const rl = readline.createInterface({
@@ -138,3 +162,3 @@ function isGitDirty() {
     return status.length > 0;
-  } catch (err) {
+  } catch {
     // If not a git repo or git not found, treat as clean/ignored
@@ -144,2 +168,5 @@ function isGitDirty() {
 function ensureDir(dirPath) {
+  if (!isPathContained(dirPath)) {
+    throw new Error(`Path containment violation: Directory target is outside root: ${dirPath}`);
+  }
   if (!fs.existsSync(dirPath)) {
@@ -247,3 +274,3 @@ async function main() {
       }).trim();
-    } catch (err) {
+    } catch {
       // Ignore SHA read error
@@ -267,4 +294,8 @@ async function main() {
     for (const file of sortedFiles) {
+      if (file.includes("..") || !isPathContained(file)) {
+        console.error(`❌ Error: Path traversal attempt detected: ${file}`);
+        cleanup();
+        process.exit(2);
+      }
       const centralFilePath = path.join(TEMP_CLONE_DIR, file);
       const localFilePath = path.join(ROOT, file);
@@ -360,2 +391,6 @@ async function main() {
     for (const item of upgradeMatrix) {
+      if (!isPathContained(item.file)) {
+        console.error(`❌ Error: Path traversal attempt detected during sync: ${item.file}`);
+        cleanup();
+        process.exit(2);
       }
       const localFilePath = path.join(ROOT, item.file);
@@ -429,3 +464,3 @@ async function main() {
       } catch (e) {
-        // Fallback to env
+        // Fallback to env
         operator = process.env.USERNAME || process.env.USER || "unknown";
@@ -469,3 +504,3 @@ function cleanup() {
     }
-  } catch (err) {
+  } catch {
     // Ignore cleanup error
@@ -474,2 +509,5 @@ function cleanup() {
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  process.exit(2);
+});
```
