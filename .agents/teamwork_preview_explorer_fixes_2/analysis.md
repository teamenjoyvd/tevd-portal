# Analysis and Proposed Edits for Tickets A, B, and C

This report provides the analysis and precise code changes (git diff style) required to implement the requirements for Tickets A, B, and C.

---

## Ticket A

### 1. `.cursor/rules/auth.mdc`
* **Requirement**: Update glob patterns from `["app/api/**/*.ts", "middleware.ts", "lib/proxy.ts"]` to `["app/api/**/*.ts", "proxy.ts"]`. Remove all clauses permitting `middleware.ts` and document that Clerk's `clerkMiddleware()` lives in `proxy.ts` at the root.
* **Proposed Changes**:
```diff
diff --git a/.cursor/rules/auth.mdc b/.cursor/rules/auth.mdc
--- a/.cursor/rules/auth.mdc
+++ b/.cursor/rules/auth.mdc
@@ -1,5 +1,5 @@
 ---
 description: Enforces Clerk authentication, protected routes, middleware scope, and proxy routing
-globs: ["app/api/**/*.ts", "middleware.ts", "lib/proxy.ts"]
+globs: ["app/api/**/*.ts", "proxy.ts"]
 alwaysApply: false
 ---
@@ -10,6 +10,6 @@
 
 ## Middleware Scope (Option C Hybrid)
 
-- Root `middleware.ts` is permitted **ONLY** for Clerk's `clerkMiddleware()` — no other logic.
-- Custom API proxy/routing logic must be implemented in `lib/proxy.ts`.
-- **NEVER** add custom routing, request rewriting, or header manipulation logic to `middleware.ts`.
+- Clerk's `clerkMiddleware()` lives in `proxy.ts` at the root of the project.
+- Custom API proxy/routing logic must be implemented in `proxy.ts`.
+- **NEVER** create or permit a `middleware.ts` file; all middleware and proxy routing logic must reside in `proxy.ts`.
```

### 2. `CLAUDE.md`
* **Requirement**: Document the `PLAN` mode exception for writing the implementation plan artifact to the brain directory.
* **Proposed Changes**:
```diff
diff --git a/CLAUDE.md b/CLAUDE.md
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -71,4 +71,4 @@
 - **Component co-location** — new components scoped to one route go in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes.
 - **Layout Decision Rules (Quantitative)** — Default is a single responsive layout file. Dual layout (separate files) is required only for: tables with 5+ columns, complex touch vs mouse drag-and-drop, persistent sidebar layouts, or interactive canvases/maps/rich-text editors. Refer to `.cursor/rules/frontend.mdc` for precise triggers.
 - **NEVER call `create_or_update_file` or `push_files` before CLAIM is complete.** No file writes until the feature branch exists and is confirmed.
-- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind. CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.
+- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind (Exception: writing the `implementation_plan.md` artifact to the brain directory). CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.
```

### 3. `.cursor/rules/database.mdc` (SQL Helper)
* **Requirement**: Correct the `get_my_clerk_id()` SQL definition in the docs block to use `request.jwt.claims`. Add warning comment: `-- DO NOT use auth.jwt() ->> 'sub' — resolves to Supabase Auth UUID, not Clerk user ID.`
* **Proposed Changes**:
```diff
diff --git a/.cursor/rules/database.mdc b/.cursor/rules/database.mdc
--- a/.cursor/rules/database.mdc
+++ b/.cursor/rules/database.mdc
@@ -18,4 +18,6 @@
 ### Helper Definitions
 ```sql
 CREATE OR REPLACE FUNCTION get_my_clerk_id()
 RETURNS text LANGUAGE sql STABLE
-AS $$ SELECT auth.jwt() ->> 'sub' $$;
+AS $$
+  -- DO NOT use auth.jwt() ->> 'sub' — resolves to Supabase Auth UUID, not Clerk user ID.
+  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'user_id'
+$$;
```

---

## Ticket B

### 1. `.cursor/rules/database.mdc` (Reference)
* **Requirement**: Change helper function source migration reference from the non-existent `20260520_002_rls.sql` to `20260315000000_baseline.sql`.
* **Proposed Changes**:
```diff
diff --git a/.cursor/rules/database.mdc b/.cursor/rules/database.mdc
--- a/.cursor/rules/database.mdc
+++ b/.cursor/rules/database.mdc
@@ -10,3 +10,3 @@
 ## RLS Gating and Helpers (Pattern A)
 
-- RLS policies must ONLY reference Pattern A helper functions which live in `20260520_002_rls.sql`:
+- RLS policies must ONLY reference Pattern A helper functions which live in `20260315000000_baseline.sql`:
```

### 2. `docs/architecture/DECISIONS.md`
* **Requirement**: Update ADR-009 status to `Superseded` and add note: `Superseded by: Quantitative dual-layout triggers in RULES.md §3 and .cursor/rules/frontend.mdc`.
* **Proposed Changes**:
```diff
diff --git a/docs/architecture/DECISIONS.md b/docs/architecture/DECISIONS.md
--- a/docs/architecture/DECISIONS.md
+++ b/docs/architecture/DECISIONS.md
@@ -20,1 +20,1 @@
-| ADR-009 | Dual-layout pattern (two complete layouts, not responsive) | 2026-03 | Active |
+| ADR-009 | Dual-layout pattern (two complete layouts, not responsive) | 2026-03 | Superseded |
@@ -288,5 +288,5 @@
 ## ADR-009 — Dual-Layout Pattern (Two Complete Layouts, Not Responsive)
 
 **Date:** 2026-03
-**Status:** Active
+**Status:** Superseded
+**Superseded by:** Quantitative dual-layout triggers in RULES.md §3 and .cursor/rules/frontend.mdc
```

### 3. `docs/ai/GOTCHAS.md`
* **Requirement**: Add a new row: `| Migration rollback | Every migration SQL file MUST include a -- ROLLBACK: comment block. Enforced by npm run validate-rules. |`.
* **Proposed Changes**:
```diff
diff --git a/docs/ai/GOTCHAS.md b/docs/ai/GOTCHAS.md
--- a/docs/ai/GOTCHAS.md
+++ b/docs/ai/GOTCHAS.md
@@ -32,3 +32,4 @@
 | Trusted RPC + service role | Any RPC that performs cross-user writes MUST be `SECURITY DEFINER SET search_path = public`. Because SECURITY DEFINER bypasses RLS, the function body MUST include an internal authorization check: `IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;`. Pattern A helpers return false/null under service-role with no JWT. `SECURITY INVOKER` is only safe for read-only helpers or trigger functions. |
+| Migration rollback | Every migration SQL file MUST include a -- ROLLBACK: comment block. Enforced by npm run validate-rules. |
```

### 4. `docs/ai/GEMINI.md`
* **Requirement**: Replace stale nomenclature `PIU` with `GCR` on line 10.
* **Proposed Changes**:
```diff
diff --git a/docs/ai/GEMINI.md b/docs/ai/GEMINI.md
--- a/docs/ai/GEMINI.md
+++ b/docs/ai/GEMINI.md
@@ -10,3 +10,3 @@
-2. **Workflow:** Every task follows: **SSU → PLAN → CLAIM → BUILD → PIU**. BUILD phases are: SHAPE → GATHER → EXECUTE → VERIFY → FINALIZE.
+2. **Workflow:** Every task follows: **SSU → PLAN → CLAIM → BUILD → GCR**. BUILD phases are: SHAPE → GATHER → EXECUTE → VERIFY → FINALIZE.
```

---

## Ticket C

### 1. `scripts/bootstrap.js`
* **Requirement**: Check `process.stdin.isTTY` at the start of `main()` and abort with code 1 if non-interactive. Replace `catch (err)` with `catch` where `err` is unused. Append `.catch()` block to the top-level `main()` call.
* **Proposed Changes**:
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
@@ -73,3 +73,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
   }
@@ -101,2 +101,7 @@
 async function main() {
+  if (!process.stdin.isTTY) {
+    console.error("Error: Input is not interactive (process.stdin.isTTY is false). Aborting.");
+    process.exit(1);
+  }
+
   const rl = readline.createInterface({
@@ -311,3 +316,3 @@
               fs.chmodSync(hookPath, 0o755);
-            } catch (err) {
+            } catch {
               // Ignore chmod error on systems where it is not supported
@@ -369,2 +374,5 @@
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  process.exit(1);
+});
```

### 2. `scripts/check-infra.js`
* **Requirement**: Fix Windows drive letter casing bug in `isPathContained` by comparing paths case-insensitively on Windows. Replace `catch (err)` with `catch` where `err` is unused.
* **Proposed Changes**:
```diff
diff --git a/scripts/check-infra.js b/scripts/check-infra.js
--- a/scripts/check-infra.js
+++ b/scripts/check-infra.js
@@ -11,4 +11,9 @@
 function isPathContained(resolvedPath) {
-  const normalizedPath = path.resolve(ROOT, resolvedPath);
-  return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
+  let normalizedPath = path.resolve(ROOT, resolvedPath);
+  let rootPath = ROOT;
+  if (process.platform === "win32") {
+    normalizedPath = normalizedPath.toLowerCase();
+    rootPath = rootPath.toLowerCase();
+  }
+  return normalizedPath === rootPath || normalizedPath.startsWith(rootPath + path.sep);
 }
@@ -54,3 +59,3 @@
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
@@ -74,3 +79,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
   }
@@ -108,3 +113,3 @@
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
   }
@@ -269,3 +274,3 @@
               }
-            } catch (err) {
+            } catch {
               // Ignore git commit log failure
```

### 3. `scripts/upgrade-infra.js`
* **Requirement**: Add `process.on('SIGINT', cleanup)` and `process.on('SIGTERM', cleanup)` hooks. Guard readline prompts by checking `process.stdin.isTTY` in `askQuestion()` (default to `'n'` if non-interactive). Fix Windows drive letter casing bug in `isPathContained`. Replace `catch (err)` with `catch` where `err` is unused. Append `.catch()` block to the top-level `main()` call.
* **Proposed Changes**:
```diff
diff --git a/scripts/upgrade-infra.js b/scripts/upgrade-infra.js
--- a/scripts/upgrade-infra.js
+++ b/scripts/upgrade-infra.js
@@ -12,4 +12,9 @@
 function isPathContained(resolvedPath) {
-  const normalizedPath = path.resolve(ROOT, resolvedPath);
-  return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
+  let normalizedPath = path.resolve(ROOT, resolvedPath);
+  let rootPath = ROOT;
+  if (process.platform === "win32") {
+    normalizedPath = normalizedPath.toLowerCase();
+    rootPath = rootPath.toLowerCase();
+  }
+  return normalizedPath === rootPath || normalizedPath.startsWith(rootPath + path.sep);
 }
@@ -18,2 +23,5 @@
 const TEMP_CLONE_DIR = path.join(ROOT, ".agentic-temp-clone");
+
+process.on("SIGINT", () => { cleanup(); process.exit(1); });
+process.on("SIGTERM", () => { cleanup(); process.exit(1); });
 
@@ -55,3 +63,3 @@
     return crypto.createHash("md5").update(normalized).digest("hex");
-  } catch (err) {
+  } catch {
     return null;
   }
@@ -75,3 +83,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore read errors
   }
@@ -109,3 +117,3 @@
       .filter(line => line && !line.startsWith("#"));
-  } catch (err) {
+  } catch {
     return [];
   }
@@ -129,2 +137,5 @@
 function askQuestion(query) {
+  if (!process.stdin.isTTY) {
+    return Promise.resolve("n");
+  }
   const rl = readline.createInterface({
@@ -149,3 +160,3 @@
     return status.length > 0;
-  } catch (err) {
+  } catch {
     // If not a git repo or git not found, treat as clean/ignored
@@ -265,3 +276,3 @@
       }).trim();
-    } catch (err) {
+    } catch {
       // Ignore SHA read error
@@ -458,3 +469,3 @@
       } catch (e) {
-        // Fallback to env
+        // Fallback to env
         operator = process.env.USERNAME || process.env.USER || "unknown";
-      }
+      }
@@ -498,3 +509,3 @@
     }
-  } catch (err) {
+  } catch {
     // Ignore cleanup error
@@ -503,2 +514,5 @@
 
-main();
+main().catch((err) => {
+  console.error("Fatal unhandled error:", err);
+  process.exit(2);
+});
```
