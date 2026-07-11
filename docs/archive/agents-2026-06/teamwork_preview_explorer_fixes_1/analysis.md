# Analysis and Proposed Edits Report

This report documents the read-only investigation, findings, and precise proposed edits to address Tickets A, B, and C requirements in the repository.

---

## Ticket A: Clerk Auth & Rules Alignment

### 1. `.cursor/rules/auth.mdc`
- **Findings**: The file currently references `middleware.ts` and `lib/proxy.ts` in both its glob patterns and scope sections. However, the application uses `proxy.ts` at the root, and a root `middleware.ts` is explicitly prohibited.
- **Proposed Diff**:
```diff
diff --git a/.cursor/rules/auth.mdc b/.cursor/rules/auth.mdc
index e569b91..4899532 100644
--- a/.cursor/rules/auth.mdc
+++ b/.cursor/rules/auth.mdc
@@ -1,6 +1,6 @@
 ---
 description: Enforces Clerk authentication, protected routes, middleware scope, and proxy routing
-globs: ["app/api/**/*.ts", "middleware.ts", "lib/proxy.ts"]
+globs: ["app/api/**/*.ts", "proxy.ts"]
 alwaysApply: false
 ---
 # Authentication and Edge Protection Rule
 
 This rule enforces constraints regarding Clerk authentication, protected routes, middleware scope, and proxy routing.
 
-## Middleware Scope (Option C Hybrid)
-
-- Root `middleware.ts` is permitted **ONLY** for Clerk's `clerkMiddleware()` — no other logic.
-- Custom API proxy/routing logic must be implemented in `lib/proxy.ts`.
-- **NEVER** add custom routing, request rewriting, or header manipulation logic to `middleware.ts`.
+## Middleware and Proxy Scope
+
+- Clerk's `clerkMiddleware()` lives in `proxy.ts` at the root of the project.
+- Root `middleware.ts` is NOT permitted; all middleware/proxy logic, including Clerk's `clerkMiddleware()`, must run in `proxy.ts` at the root.
+- Custom API proxy/routing logic must be implemented in `proxy.ts` as well.
+- **NEVER** create or use a root `middleware.ts` file.
```

### 2. `CLAUDE.md`
- **Findings**: Line 74 in `CLAUDE.md` specifies that the SSU, PLAN, CLAIM, and BUILD modes are mutually exclusive, and PLAN does no writes of any kind. An exception exists when running in Antigravity where the `implementation_plan.md` artifact is written/updated in the brain directory.
- **Proposed Diff**:
```diff
diff --git a/CLAUDE.md b/CLAUDE.md
index d53372c..84cd9df 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -71,5 +71,5 @@ Violation = immediate stop, no exceptions.
 - Component co-location — new components scoped to one route go in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes.
 - Layout Decision Rules (Quantitative) — Default is a single responsive layout file. Dual layout (separate files) is required only for: tables with 5+ columns, complex touch vs mouse drag-and-drop, persistent sidebar layouts, or interactive canvases/maps/rich-text editors. Refer to `.cursor/rules/frontend.mdc` for precise triggers.
 - NEVER call `create_or_update_file` or `push_files` before CLAIM is complete. No file writes until the feature branch exists and is confirmed.
-- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind. CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.
+- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind (except writing/updating the `implementation_plan.md` artifact in the brain directory when running in Antigravity). CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.
```

### 3. `.cursor/rules/database.mdc` (SQL Helper)
- **Findings**: The file has an outdated definition of `get_my_clerk_id()` that references `auth.jwt() ->> 'sub'`. It needs to use `current_setting('request.jwt.claims', true)::jsonb ->> 'user_id'` and include a warning comment.
- **Proposed Diff**:
```diff
diff --git a/.cursor/rules/database.mdc b/.cursor/rules/database.mdc
index 28df8ad..38ea982 100644
--- a/.cursor/rules/database.mdc
+++ b/.cursor/rules/database.mdc
@@ -16,6 +16,7 @@
 
 ### Helper Definitions
 ```sql
+-- DO NOT use auth.jwt() ->> 'sub' — resolves to Supabase Auth UUID, not Clerk user ID
 CREATE OR REPLACE FUNCTION get_my_clerk_id()
 RETURNS text LANGUAGE sql STABLE
-AS $$ SELECT auth.jwt() ->> 'sub' $$;
+AS $$ SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'user_id' $$;
```

---

## Ticket B: Documentation & Architecture Rules Fixes

### 1. `.cursor/rules/database.mdc` (Reference)
- **Findings**: The file references `20260520_002_rls.sql` as the location for helper functions, which is non-existent. These functions are actually defined in `20260315000000_baseline.sql`.
- **Proposed Diff**:
```diff
diff --git a/.cursor/rules/database.mdc b/.cursor/rules/database.mdc
index 28df8ad..38ea982 100644
--- a/.cursor/rules/database.mdc
+++ b/.cursor/rules/database.mdc
@@ -9,5 +9,5 @@
 
 ## RLS Gating and Helpers (Pattern A)
 
-- - **RLS policies must ONLY reference Pattern A helper functions** which live in `20260520_002_rls.sql`:
+- - **RLS policies must ONLY reference Pattern A helper functions** which live in `20260315000000_baseline.sql`:
```

### 2. `docs/architecture/DECISIONS.md`
- **Findings**: The status of ADR-009 is currently listed as `Active` and needs to be marked as `Superseded` both in the status index and the section itself, pointing to `RULES.md §3` and `.cursor/rules/frontend.mdc`.
- **Proposed Diff**:
```diff
diff --git a/docs/architecture/DECISIONS.md b/docs/architecture/DECISIONS.md
index a5d3e09..2b79da9 100644
--- a/docs/architecture/DECISIONS.md
+++ b/docs/architecture/DECISIONS.md
@@ -17,5 +17,5 @@
 | ADR-006 | proxy.ts as the sole middleware file (never middleware.ts) | 2026-03 | Active |
 | ADR-007 | Unified payments table (single table, entity check constraint) | 2026-03 | Active |
 | ADR-008 | Strict TranslationKey union over i18n library | 2026-03 | Active |
-| ADR-009 | Dual-layout pattern (two complete layouts, not responsive) | 2026-03 | Active |
+| ADR-009 | Dual-layout pattern (two complete layouts, not responsive) | 2026-03 | Superseded |
 | ADR-010 | 12-column CSS grid for BentoGrid (not a component library) | 2026-03 | Active |
@@ -288,5 +288,6 @@
 ## ADR-009 — Dual-Layout Pattern (Two Complete Layouts, Not Responsive)
 
 **Date:** 2026-03
-**Status:** Active
+**Status:** Superseded
+**Note:** Superseded by: Quantitative dual-layout triggers in RULES.md §3 and .cursor/rules/frontend.mdc
```

### 3. `docs/ai/GOTCHAS.md`
- **Findings**: Need to document the requirement that every migration SQL file includes a `-- ROLLBACK:` block.
- **Proposed Diff**:
```diff
diff --git a/docs/ai/GOTCHAS.md b/docs/ai/GOTCHAS.md
index 1d9e2a8..3f1ab94 100644
--- a/docs/ai/GOTCHAS.md
+++ b/docs/ai/GOTCHAS.md
@@ -32,2 +32,3 @@
 | Trusted RPC + service role | Any RPC that performs cross-user writes MUST be `SECURITY DEFINER SET search_path = public`. Because SECURITY DEFINER bypasses RLS, the function body MUST include an internal authorization check: `IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;`. Pattern A helpers return false/null under service-role with no JWT. `SECURITY INVOKER` is only safe for read-only helpers or trigger functions. |
+| Migration rollback | Every migration SQL file MUST include a -- ROLLBACK: comment block. Enforced by npm run validate-rules. |
```

### 4. `docs/ai/GEMINI.md`
- **Findings**: Line 10 refers to `PIU` instead of `GCR`.
- **Proposed Diff**:
```diff
diff --git a/docs/ai/GEMINI.md b/docs/ai/GEMINI.md
index a08bb9d..278cd65 100644
--- a/docs/ai/GEMINI.md
+++ b/docs/ai/GEMINI.md
@@ -7,5 +7,5 @@
 ## 🛠️ Operational Rules
 1. **The Laws:** Strictly enforce all Hard Constraints from `CLAUDE.md` (no `middleware.ts`, dual layout law, shadcn for all interactive primitives, 390px mobile-first, etc.).
-2. **Workflow:** Every task follows: **SSU → PLAN → CLAIM → BUILD → PIU**. BUILD phases are: SHAPE → GATHER → EXECUTE → VERIFY → FINALIZE.
+2. **Workflow:** Every task follows: **SSU → PLAN → CLAIM → BUILD → GCR**. BUILD phases are: SHAPE → GATHER → EXECUTE → VERIFY → FINALIZE.
```

---

## Ticket C: Infrastructure Scripts Hardening

### 1. `scripts/bootstrap.js`
- **Findings**: The script needs `process.stdin.isTTY` check at `main()`, unused catch parameter cleanups, and a top-level `.catch()` handler.
- **Proposed Diff**:
```diff
diff --git a/scripts/bootstrap.js b/scripts/bootstrap.js
index f30cae7..1b66df2 100644
--- a/scripts/bootstrap.js
+++ b/scripts/bootstrap.js
@@ -53,3 +53,3 @@ function getGitSha() {
       .toString()
-      .trim();
-  } catch (err) {
+      .trim();
+  } catch {
     return "";
@@ -73,3 +73,3 @@ function getFilesRecursive(dir) {
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
@@ -101,2 +101,7 @@ function scanTrackedFiles() {
 async function main() {
+  if (!process.stdin.isTTY) {
+    console.error("Error: Bootstrap script must be run interactively.");
+    process.exit(1);
+  }
+
   const rl = readline.createInterface({
@@ -311,3 +316,3 @@ async function main() {
               fs.chmodSync(hookPath, 0o755);
-            } catch (err) {
+            } catch {
               // Ignore chmod error on systems where it is not supported
@@ -368,3 +373,6 @@ async function main() {
 
-main();
+main().catch((err) => {
+  console.error("Unhandled rejection in main:", err);
+  process.exit(1);
+});
```

### 2. `scripts/check-infra.js`
- **Findings**: Fix Windows path case-insensitivity in `isPathContained` to avoid false traversal detections, and remove unused `catch (err)` bindings.
- **Proposed Diff**:
```diff
diff --git a/scripts/check-infra.js b/scripts/check-infra.js
index cc8d1f9..0f948f2 100644
--- a/scripts/check-infra.js
+++ b/scripts/check-infra.js
@@ -11,4 +11,9 @@ const ROOT = path.resolve(__dirname, "..");
 function isPathContained(resolvedPath) {
   const normalizedPath = path.resolve(ROOT, resolvedPath);
+  if (process.platform === "win32") {
+    const rootLower = ROOT.toLowerCase();
+    const pathLower = normalizedPath.toLowerCase();
+    return pathLower === rootLower || pathLower.startsWith(rootLower + path.sep);
+  }
   return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
 }
@@ -52,3 +57,3 @@ function computeHash(filePath) {
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
@@ -72,3 +77,3 @@ function getFilesRecursive(dir) {
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
@@ -106,3 +111,3 @@ function loadInfraIgnore() {
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
@@ -267,3 +272,3 @@ function main() {
                 }).trim();
-              }
-            } catch (err) {
+              }
+            } catch {
               // Ignore git commit log failure
```

### 3. `scripts/upgrade-infra.js`
- **Findings**: Add SIGINT/SIGTERM handlers to clean up the temp clone folder, check `process.stdin.isTTY` in `askQuestion()` to prevent hanging in non-interactive environments, fix Windows path containment casing checks, and remove unused `catch` bindings.
- **Proposed Diff**:
```diff
diff --git a/scripts/upgrade-infra.js b/scripts/upgrade-infra.js
index bc6711d..8a7a8d9 100644
--- a/scripts/upgrade-infra.js
+++ b/scripts/upgrade-infra.js
@@ -12,4 +12,9 @@ const ROOT = path.resolve(__dirname, "..");
 function isPathContained(resolvedPath) {
   const normalizedPath = path.resolve(ROOT, resolvedPath);
+  if (process.platform === "win32") {
+    const rootLower = ROOT.toLowerCase();
+    const pathLower = normalizedPath.toLowerCase();
+    return pathLower === rootLower || pathLower.startsWith(rootLower + path.sep);
+  }
   return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
 }
@@ -53,3 +58,3 @@ function computeHash(filePath) {
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
@@ -73,3 +78,3 @@ function getFilesRecursive(dir) {
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
@@ -107,3 +112,3 @@ function loadInfraIgnore() {
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
@@ -127,10 +132,18 @@ function isIgnored(file, ignoreList) {
 
 // Helper to ask a question via terminal
 function askQuestion(query) {
+  if (!process.stdin.isTTY) {
+    console.log(query + " [Non-interactive: defaulted to 'n']");
+    return Promise.resolve("n");
+  }
   const rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
   });
   return new Promise(resolve => rl.question(query, answer => {
     rl.close();
     resolve(answer.trim());
   }));
 }
 
 // Check if local working tree is dirty
@@ -147,3 +160,3 @@ function isGitDirty() {
     return status.length > 0;
-  } catch (err) {
+  } catch {
     // If not a git repo or git not found, treat as clean/ignored
@@ -163,2 +176,12 @@ function ensureDir(dirPath) {
 
+// Register signal handlers for clean up
+process.on("SIGINT", () => {
+  cleanup();
+  process.exit(1);
+});
+process.on("SIGTERM", () => {
+  cleanup();
+  process.exit(1);
+});
+
 // Main function
@@ -263,3 +286,3 @@ async function main() {
       }).trim();
-    } catch (err) {
+    } catch {
       // Ignore SHA read error
@@ -456,3 +479,3 @@ async function main() {
         stdio: ["ignore", "pipe", "ignore"]
-      }).trim();
-    } catch (e) {
+      }).trim();
+    } catch {
       // Fallback to env
@@ -496,3 +519,3 @@ function cleanup() {
     }
-  } catch (err) {
+  } catch {
     // Ignore cleanup error
@@ -501,3 +524,7 @@ function cleanup() {
 
-main();
+main().catch((err) => {
+  console.error("Unhandled rejection in main:", err);
+  cleanup();
+  process.exit(2);
+});
```

---

## Handoff Report (5-Component Structure)

### 1. Observation
All targeted configuration files (`.cursor/rules/auth.mdc`, `CLAUDE.md`, `.cursor/rules/database.mdc`), architecture documentation (`docs/architecture/DECISIONS.md`, `docs/ai/GOTCHAS.md`, `docs/ai/GEMINI.md`), and infrastructure Node.js scripts (`scripts/bootstrap.js`, `scripts/check-infra.js`, `scripts/upgrade-infra.js`) were read using `view_file`. Key observations:
- Glob patterns in `.cursor/rules/auth.mdc` included `middleware.ts` (violating naming constraints) and `lib/proxy.ts` (deprecated path).
- `CLAUDE.md` lacked documentation of the PLAN mode exception for writing artifacts in Antigravity mode.
- `get_my_clerk_id()` SQL helper documentation in `.cursor/rules/database.mdc` relied on the broken `auth.jwt() ->> 'sub'` pattern.
- Script files used `catch (err)` bindings without using the `err` variable, causing minor lint warnings or clutter.
- `isPathContained` did a case-sensitive check on absolute paths, failing on Windows environments due to differences in drive letter casing (e.g. `C:` vs `c:`).
- `bootstrap.js` and `upgrade-infra.js` readline interfaces could block in non-interactive CI environments.
- `upgrade-infra.js` lacked signal handling for cleaning up the `.agentic-temp-clone` directory on abrupt terminations.

### 2. Logic Chain
- Moving authentication to `proxy.ts` requires updating globs and scope statements in `auth.mdc` to avoid confusion.
- Adding the PLAN mode exception to `CLAUDE.md` aligns the hard constraints with Antigravity's operational constraints.
- Swapping `auth.jwt() ->> 'sub'` with `current_setting('request.jwt.claims', true)::jsonb ->> 'user_id'` fixes RLS evaluation for Clerk users.
- Windows drive letter comparison requires `.toLowerCase()` because windows path mapping is case-insensitive.
- `process.stdin.isTTY` check prevents blocking operations when the scripts run inside automation runners (like GitHub Actions/Vercel).
- Adding signal events (`SIGINT`/`SIGTERM`) and a `.catch()` block ensures that temporary clone cleanup executes reliably.

### 3. Caveats
- Actual migrations were not executed (read-only investigation).
- Assumed standard Node.js `process.platform === 'win32'` matches the user's running environment structure.

### 4. Conclusion
The proposed changes completely resolve the mismatches, warnings, and robustness concerns identified in the infrastructure audit. Implementing these diffs satisfies Tickets A, B, and C requirements.

### 5. Verification Method
1. Apply the diffs.
2. Run validation rules checking: `npm run validate-rules`.
3. Check the baseline hashes: `npm run agentic:check`.
4. Build the application: `npm run build`.
