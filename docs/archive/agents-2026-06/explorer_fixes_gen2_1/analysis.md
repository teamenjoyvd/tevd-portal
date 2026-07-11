# Analysis and Proposed Fixes for Tickets A, B, and C

This report analyzes the current codebase state against the requirements for the infrastructure fixes (Tickets A, B, and C) and lists the proposed diffs for each affected file.

---

## Executive Summary & Core Findings

1. **Reversion Root Cause**: A previous implementation phase completed the requested fixes, but during the verification stage, running `node scripts/upgrade-infra.js --force` pulled the templates from the upstream central repository and overwrote local changes.
2. **Infra Ignore Scope**: Files that were listed in `.infraignore` (such as `.cursor/rules/auth.mdc`, `CLAUDE.md`, `docs/ai/PLAN.md`, etc.) were skipped by the upgrade script sync, preserving their correct states.
3. **Overwritten Files**: Files not included in `.infraignore` (specifically `.cursor/rules/database.mdc`, `scripts/bootstrap.js`, `scripts/check-infra.js`, and `scripts/upgrade-infra.js`) were overwritten and reverted back to the upstream templates, which completely wiped out the path traversal security checks, TTY guards, sorted hashing baselines, and corrected SQL helper declarations.
4. **Action Plan**: This plan restores all required features, secures scripts against path traversal (rejecting any paths containing `..` or escaping the root, with case-insensitive comparisons on Windows to handle drive letter anomalies), handles TTY status for non-interactive execution, and updates metadata rules correctly.

---

## File Status Matrix

| File Path | Status on Disk | Requirements | Action |
|---|---|---|---|
| `.cursor/rules/auth.mdc` | **Correct** | Glob pattern `["app/api/**/*.ts", "proxy.ts"]`, no `middleware.ts` allowance, document Clerk auth in `proxy.ts`. | None |
| `CLAUDE.md` | **Correct** | Document PLAN mode exception for `implementation_plan.md` artifact. | None |
| `.cursor/rules/database.mdc` | **Incorrect (Overwritten)** | Update SQL definition of `get_my_clerk_id()` (use `request.jwt.claims`) + warning comment; reference `20260315000000_baseline.sql` instead of non-existent migration. | Proposed Diff |
| `docs/architecture/DECISIONS.md` | **Correct** | ADR-009 status `Superseded` with replacement references. | None |
| `docs/ai/GOTCHAS.md` | **Correct** | Migration rollback rule entry added. | None |
| `docs/ai/GEMINI.md` | **Correct** | Nomenclature `PIU` replaced with `GCR` on line 10. | None |
| `scripts/bootstrap.js` | **Incorrect (Overwritten)** | TTY non-interactive check, append `.catch()`, remove unused `catch (err)`, prepend validation hook right after shebang if exits/logic exist, sort/dedup scan baseline. | Proposed Diff |
| `scripts/check-infra.js` | **Incorrect (Overwritten)** | Case-insensitive Windows path traversal check, remove unused `catch (err)`, check path containment before reading. | Proposed Diff |
| `scripts/upgrade-infra.js` | **Incorrect (Overwritten)** | SIGINT/SIGTERM handlers, default prompt to `'n'` if TTY false, case-insensitive Windows path traversal check, remove unused `catch (err)`, append `.catch()`, check path containment before reading, writing, copying, or deleting. | Proposed Diff |
| `docs/ai/PLAN.md` | **Correct** | Language tag `markdown` added to fenced code block at lines 11-15. | None |
| `.infraignore` | **Correct** | Exclude `docs/ai/CLAIM.md` from upstream scaffolding updates. | None |

---

## Proposed Diffs

### 1. `.cursor/rules/database.mdc`

**Rationale**:
- Update RLS Pattern A reference to the actual baseline migration file `20260315000000_baseline.sql`.
- Update helper definition for `get_my_clerk_id()` to resolve to the Clerk User ID from the requests JWT claims instead of Supabase Auth metadata `sub` claim.
- Add warning comment advising against `auth.jwt() ->> 'sub'`.

```diff
diff --git a/.cursor/rules/database.mdc b/.cursor/rules/database.mdc
--- a/.cursor/rules/database.mdc
+++ b/.cursor/rules/database.mdc
@@ -10,3 +10,3 @@
 ## RLS Gating and Helpers (Pattern A)
 
-- RLS policies must ONLY reference Pattern A helper functions which live in `20260520_002_rls.sql`:
+- RLS policies must ONLY reference Pattern A helper functions which live in `20260315000000_baseline.sql`:
@@ -18,4 +18,7 @@
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

**Rationale**:
- Enforce interactive CLI checks: abort execution with code `1` if running in a non-interactive shell environment.
- Clean up unused error variables in catch blocks.
- Pre-commit hook installer: if existing hook has logic or exits, prepend validation script directly beneath shebang. Otherwise, append normally.
- stable baseline hashes: sort and deduplicate files in `scanTrackedFiles()`.
- Add a `.catch()` exception boundary at the script execution level.

```diff
diff --git a/scripts/bootstrap.js b/scripts/bootstrap.js
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
@@ -93,3 +93,3 @@
   }
-  return files;
+  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
 }
@@ -97,2 +97,7 @@
 async function main() {
+  if (!process.stdin.isTTY) {
+    console.error("Error: Input is not interactive (process.stdin.isTTY is false). Aborting.");
+    process.exit(1);
+  }
+
   const rl = readline.createInterface({
@@ -268,14 +273,26 @@
       const hookContent = "#!/bin/sh\nnode scripts/validate-rules.js\n";
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
+            const hasExitOrOther = existingHook.includes("exit") || 
+              existingHook.trim().split("\n").filter(line => line.trim() && !line.trim().startsWith("#")).length > 0;
+            
+            if (hasExitOrOther) {
+              const shebangMatch = existingHook.match(/^#![^\r\n]+/);
+              if (shebangMatch) {
+                const shebang = shebangMatch[0];
+                const restOfHook = existingHook.substring(shebang.length);
+                const newHookContent = `${shebang}\nnode scripts/validate-rules.js\n${restOfHook}`;
+                fs.writeFileSync(hookPath, newHookContent, { encoding: "utf8", mode: 0o755 });
+              } else {
+                const newHookContent = `node scripts/validate-rules.js\n${existingHook}`;
+                fs.writeFileSync(hookPath, newHookContent, { encoding: "utf8", mode: 0o755 });
+              }
+              console.log("  ✅ Pre-commit hook updated (prepended rule validator).");
+              summary.created.push(".git/hooks/pre-commit (updated)");
+            } else {
+              fs.appendFileSync(hookPath, "\nnode scripts/validate-rules.js\n");
+              console.log("  ✅ Pre-commit hook updated (appended rule validator).");
+              summary.created.push(".git/hooks/pre-commit (updated)");
+            }
             shouldWrite = false;
           }
         }
@@ -335,3 +352,6 @@
 }
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  process.exit(1);
+});
```

---

### 3. `scripts/check-infra.js`

**Rationale**:
- Implement the path containment safety helper `isPathContained()` with a case-insensitive drive letter check on Windows, and immediate rejection of any path containing `..`.
- Guard all file scanning, reading, and hash checking methods with `isPathContained()`.
- Abort checking execution with code `1` if any traversal attempt is detected.
- Replace unused `catch (err)` variables with simple `catch` statements.

```diff
diff --git a/scripts/check-infra.js b/scripts/check-infra.js
--- a/scripts/check-infra.js
+++ b/scripts/check-infra.js
@@ -9,2 +9,13 @@
 const ROOT = path.resolve(__dirname, "..");
 
+function isPathContained(resolvedPath) {
+  if (typeof resolvedPath !== "string" || resolvedPath.includes("..")) {
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
@@ -41,2 +52,5 @@
 function computeHash(filePath) {
+  if (!isPathContained(filePath)) {
+    return null;
+  }
   if (!fs.existsSync(filePath)) return null;
@@ -48,3 +62,3 @@
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
@@ -54,2 +68,5 @@
 function getFilesRecursive(dir) {
+  if (!isPathContained(dir)) {
+    return [];
+  }
   if (!fs.existsSync(dir)) return [];
@@ -67,3 +84,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
@@ -77,2 +94,3 @@
     const dirPath = path.join(ROOT, dir);
+    if (!isPathContained(dirPath)) continue;
     const dirFiles = getFilesRecursive(dirPath);
@@ -83,2 +101,3 @@
   for (const f of TRACKED_FILES) {
     const filePath = path.join(ROOT, f);
+    if (!isPathContained(filePath)) continue;
     if (fs.existsSync(filePath)) {
@@ -94,2 +113,6 @@
 function loadInfraIgnore() {
   const ignorePath = path.join(ROOT, ".infraignore");
+  if (!isPathContained(ignorePath)) {
+    return [];
+  }
   if (!fs.existsSync(ignorePath)) return [];
@@ -101,3 +124,3 @@
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
@@ -130,2 +153,6 @@
   const configPath = path.join(ROOT, "agentic.config.json");
+  if (!isPathContained(configPath)) {
+    console.error("❌ Security Error: Unsafe config path.");
+    process.exit(2);
+  }
   if (!fs.existsSync(configPath)) {
@@ -189,2 +216,6 @@
     const fullPath = path.join(ROOT, file);
+    if (!isPathContained(fullPath) || file.includes("..")) {
+      console.error(`❌ Security Error: Path traversal attempt detected: ${file}`);
+      process.exit(1);
+    }
     const hasBaseline = baselineHashes.hasOwnProperty(file);
@@ -229,2 +260,6 @@
       if (res.status === "MODIFIED") {
+        if (!isPathContained(path.join(ROOT, res.file)) || res.file.includes("..")) {
+          console.error(`❌ Security Error: Unsafe path in diff: ${res.file}`);
+          process.exit(1);
+        }
         console.log(`\n--- Diff for ${res.file} ---`);
@@ -255,3 +290,3 @@
               }
-            } catch (err) {
+            } catch {
               // Ignore git commit log failure
```

---

### 4. `scripts/upgrade-infra.js`

**Rationale**:
- Implement `isPathContained()` with a case-insensitive drive letter check on Windows, and immediate rejection of any path containing `..`.
- Bind process termination handlers (`SIGINT` and `SIGTERM`) to trigger immediate clone repository cleanup (`cleanup()`) and graceful process exit.
- Guard prompt queries with `process.stdin.isTTY` in `askQuestion()`, defaulting immediately to `'n'` if running in a non-interactive shell.
- Guard all directory cloning, hash calculating, ignore loading, files analysis, writing, deleting, and config serialization hooks with containment checks.
- Replace unused error variables in catch blocks with parameterless `catch` blocks.
- Add a `.catch()` exception boundary at the script execution level.

```diff
diff --git a/scripts/upgrade-infra.js b/scripts/upgrade-infra.js
--- a/scripts/upgrade-infra.js
+++ b/scripts/upgrade-infra.js
@@ -11,2 +11,21 @@
 const TEMP_CLONE_DIR = path.join(ROOT, ".agentic-temp-clone");
 
+function isPathContained(resolvedPath) {
+  if (typeof resolvedPath !== "string" || resolvedPath.includes("..")) {
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
@@ -41,2 +60,5 @@
 function computeHash(filePath) {
+  if (!isPathContained(filePath)) {
+    return null;
+  }
   if (!fs.existsSync(filePath)) return null;
@@ -48,3 +70,3 @@
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
@@ -54,2 +76,5 @@
 function getFilesRecursive(dir) {
+  if (!isPathContained(dir)) {
+    return [];
+  }
   if (!fs.existsSync(dir)) return [];
@@ -67,3 +92,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
@@ -74,2 +99,5 @@
 function scanDirectoryTrackedFiles(basePath) {
+  if (!isPathContained(basePath)) {
+    return [];
+  }
   const files = [];
@@ -77,2 +105,3 @@
     const dirPath = path.join(basePath, dir);
+    if (!isPathContained(dirPath)) continue;
     const dirFiles = getFilesRecursive(dirPath);
@@ -83,2 +112,3 @@
   for (const f of TRACKED_FILES) {
     const filePath = path.join(basePath, f);
+    if (!isPathContained(filePath)) continue;
     if (fs.existsSync(filePath)) {
@@ -94,2 +124,6 @@
 function loadInfraIgnore() {
   const ignorePath = path.join(ROOT, ".infraignore");
+  if (!isPathContained(ignorePath)) {
+    return [];
+  }
   if (!fs.existsSync(ignorePath)) return [];
@@ -101,3 +135,3 @@
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
@@ -118,2 +152,5 @@
 function askQuestion(query) {
+  if (!process.stdin.isTTY) {
+    return Promise.resolve("n");
+  }
   const rl = readline.createInterface({
@@ -131,2 +168,5 @@
   try {
+    if (!isPathContained(ROOT)) {
+      return false;
+    }
     const status = execSync("git status --porcelain", {
@@ -138,3 +178,3 @@
     return status.length > 0;
-  } catch (err) {
+  } catch {
     // If not a git repo or git not found, treat as clean/ignored
@@ -172,2 +212,6 @@
   const configPath = path.join(ROOT, "agentic.config.json");
+  if (!isPathContained(configPath)) {
+    console.error("❌ Security Error: Unsafe config path.");
+    process.exit(2);
+  }
   if (!fs.existsSync(configPath)) {
@@ -216,2 +260,5 @@
     fs.rmSync(TEMP_CLONE_DIR, { recursive: true, force: true });
+    if (!isPathContained(TEMP_CLONE_DIR)) {
+      throw new Error("Temp clone directory path traversal blocked.");
+    }
     const branchFlag = branch ? `-b "${branch}"` : "";
@@ -233,2 +280,5 @@
     const centralConfigPath = path.join(TEMP_CLONE_DIR, "package.json");
+    if (!isPathContained(centralConfigPath)) {
+      throw new Error("Central package.json path traversal blocked.");
+    }
     if (!fs.existsSync(centralConfigPath)) {
@@ -247,3 +297,3 @@
       // Ignore SHA read error
-    }
+    }
 
@@ -268,2 +318,8 @@
       const localFilePath = path.join(ROOT, file);
 
+      if (!isPathContained(localFilePath) || !isPathContained(centralFilePath) || file.includes("..")) {
+        console.error(`❌ Security Error: Path traversal attempt detected: ${file}`);
+        cleanup();
+        process.exit(1);
+      }
+
       const existsInCentral = fs.existsSync(centralFilePath);
@@ -364,2 +420,7 @@
 
+      if (!isPathContained(localFilePath) || !isPathContained(centralFilePath) || item.file.includes("..")) {
+        console.error(`❌ Security Error: Path traversal attempt blocked during write/delete: ${item.file}`);
+        cleanup();
+        process.exit(1);
+      }
+
       if (item.action === "DELETE") {
@@ -399,2 +460,7 @@
       for (const file of localTrackedFiles) {
         if (isIgnored(file, ignoreList)) continue;
+        const localFilePath = path.join(ROOT, file);
+        if (!isPathContained(localFilePath) || file.includes("..")) {
+          console.error(`❌ Security Error: Path traversal attempt blocked during config hash update: ${file}`);
+          cleanup();
+          process.exit(1);
+        }
         const hash = computeHash(localFilePath);
@@ -409,2 +475,7 @@
       const configTmpPath = configPath + ".tmp";
+      if (!isPathContained(configPath) || !isPathContained(configTmpPath)) {
+        console.error(`❌ Security Error: Config path traversal blocked.`);
+        cleanup();
+        process.exit(1);
+      }
       fs.writeFileSync(configTmpPath, JSON.stringify(currentConfig, null, 2) + "\n", "utf8");
@@ -420,2 +491,6 @@
       const logPath = path.join(ROOT, ".agentic-upgrade-log");
+      if (!isPathContained(logPath)) {
+        console.error(`❌ Security Error: Log path traversal blocked.`);
+        cleanup();
+        process.exit(1);
       }
@@ -428,3 +503,3 @@
         }).trim();
-      } catch (e) {
+      } catch {
         // Fallback to env
@@ -468,3 +543,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore cleanup error
@@ -474,2 +549,5 @@
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  process.exit(2);
+});
```
