# Analysis and Proposed Edits for Tickets A, B, and C

This analysis document outlines the exact modifications required for files corresponding to Ticket A, Ticket B, and Ticket C. As this is a read-only investigation, the proposed changes are structured below with clear context, rationale, and exact replacement diffs.

---

## Ticket A

### 1. `.cursor/rules/auth.mdc`
- **Goal:** Update glob patterns from `["app/api/**/*.ts", "middleware.ts", "lib/proxy.ts"]` to `["app/api/**/*.ts", "proxy.ts"]`. Remove all clauses permitting `middleware.ts` and document that Clerk's `clerkMiddleware()` lives in `proxy.ts` at the root.
- **Rationale:** The project does not use a root-level `middleware.ts` file; Next.js middleware routing and custom proxy logic are unified in `proxy.ts` at the root.

#### Proposed Change:
```markdown
<<<<
globs: ["app/api/**/*.ts", "middleware.ts", "lib/proxy.ts"]
====
globs: ["app/api/**/*.ts", "proxy.ts"]
>>>>
```
and
```markdown
<<<<
## Middleware Scope (Option C Hybrid)

- Root `middleware.ts` is permitted **ONLY** for Clerk's `clerkMiddleware()` — no other logic.
- Custom API proxy/routing logic must be implemented in `lib/proxy.ts`.
- **NEVER** add custom routing, request rewriting, or header manipulation logic to `middleware.ts`.
====
## Middleware Scope (Option C Hybrid)

- Clerk's `clerkMiddleware()` lives in `proxy.ts` at the root.
- Custom API proxy/routing logic must be implemented in `proxy.ts` at the root.
- **NEVER** create `middleware.ts` at the root. All middleware and proxy routing logic must reside in `proxy.ts`.
>>>>
```

---

### 2. `CLAUDE.md`
- **Goal:** Document the `PLAN` mode exception for writing the implementation plan artifact to the brain directory.
- **Rationale:** PLAN mode is strictly read-only, but it is permitted to write the `implementation_plan.md` artifact to the brain directory when running as Antigravity.

#### Proposed Change:
```markdown
<<<<
- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind. CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.
====
- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind (exception: writing the implementation plan artifact to the brain directory). CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.
>>>>
```

---

### 3. `.cursor/rules/database.mdc` (SQL Helper & Reference)
- **Goal:** Correct the `get_my_clerk_id()` SQL definition in the docs block to use `request.jwt.claims`. Add warning comment: `-- DO NOT use auth.jwt() ->> 'sub' — resolves to Supabase Auth UUID, not Clerk user ID.`. Update helper function source migration reference from `20260520_002_rls.sql` to `20260315000000_baseline.sql`.
- **Rationale:** Align documentation with the true DB schema baseline, and ensure developers do not use `auth.jwt() ->> 'sub'` since Clerk is the identity provider and the sub claim resolves to a Supabase UUID instead of the Clerk ID.

#### Proposed Change:
```markdown
<<<<
- **RLS policies must ONLY reference Pattern A helper functions** which live in `20260520_002_rls.sql`:
  - `get_my_clerk_id()` - Returns the Clerk user ID from the JWT sub claim.
  - `get_my_profile_id()` - Returns the profile ID for the current Clerk user.
- **NEVER** use raw `auth.jwt()` or other inline mechanisms within RLS policies.

### Helper Definitions
```sql
CREATE OR REPLACE FUNCTION get_my_clerk_id()
RETURNS text LANGUAGE sql STABLE
AS $$ SELECT auth.jwt() ->> 'sub' $$;

CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT id FROM profiles WHERE clerk_id = get_my_clerk_id() $$;
```
====
- **RLS policies must ONLY reference Pattern A helper functions** which live in `20260315000000_baseline.sql`:
  - `get_my_clerk_id()` - Returns the Clerk user ID from the JWT sub claim.
  - `get_my_profile_id()` - Returns the profile ID for the current Clerk user.
- **NEVER** use raw `auth.jwt()` or other inline mechanisms within RLS policies.

### Helper Definitions
```sql
CREATE OR REPLACE FUNCTION get_my_clerk_id()
RETURNS text LANGUAGE sql STABLE
AS $$
  -- DO NOT use auth.jwt() ->> 'sub' — resolves to Supabase Auth UUID, not Clerk user ID.
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'user_id';
$$;

CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT id FROM profiles WHERE clerk_id = get_my_clerk_id() $$;
```
>>>>
```

---

## Ticket B

### 1. `docs/architecture/DECISIONS.md`
- **Goal:** Update ADR-009 status to `Superseded` (both in the index table and detail header) and add the note: `Superseded by: Quantitative dual-layout triggers in RULES.md §3 and .cursor/rules/frontend.mdc.`.
- **Rationale:** Keep architecture records accurate and sync them with new layout selection rules.

#### Proposed Change:
```markdown
<<<<
| ADR-009 | Dual-layout pattern (two complete layouts, not responsive) | 2026-03 | Active |
====
| ADR-009 | Dual-layout pattern (two complete layouts, not responsive) | 2026-03 | Superseded |
>>>>
```
and
```markdown
<<<<
## ADR-009 — Dual-Layout Pattern (Two Complete Layouts, Not Responsive)

**Date:** 2026-03
**Status:** Active
====
## ADR-009 — Dual-Layout Pattern (Two Complete Layouts, Not Responsive)

**Date:** 2026-03
**Status:** Superseded
**Note:** Superseded by: Quantitative dual-layout triggers in RULES.md §3 and .cursor/rules/frontend.mdc
>>>>
```

---

### 2. `docs/ai/GOTCHAS.md`
- **Goal:** Add a new row: `| Migration rollback | Every migration SQL file MUST include a -- ROLLBACK: comment block. Enforced by npm run validate-rules. |`
- **Rationale:** Document the validation constraint on SQL migration files to prevent rollbacks from being ignored or left out.

#### Proposed Change:
```markdown
<<<<
| `TeamAttendee` type | Exported from `app/(dashboard)/trips/[id]/page.tsx`. Do not redeclare. |
| Trusted RPC + service role | Any RPC that performs cross-user writes MUST be `SECURITY DEFINER SET search_path = public`. Because SECURITY DEFINER bypasses RLS, the function body MUST include an internal authorization check: `IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;`. Pattern A helpers return false/null under service-role with no JWT. `SECURITY INVOKER` is only safe for read-only helpers or trigger functions. |
====
| `TeamAttendee` type | Exported from `app/(dashboard)/trips/[id]/page.tsx`. Do not redeclare. |
| Trusted RPC + service role | Any RPC that performs cross-user writes MUST be `SECURITY DEFINER SET search_path = public`. Because SECURITY DEFINER bypasses RLS, the function body MUST include an internal authorization check: `IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;`. Pattern A helpers return false/null under service-role with no JWT. `SECURITY INVOKER` is only safe for read-only helpers or trigger functions. |
| Migration rollback | Every migration SQL file MUST include a -- ROLLBACK: comment block. Enforced by npm run validate-rules. |
>>>>
```

---

### 3. `docs/ai/GEMINI.md`
- **Goal:** Replace stale nomenclature `PIU` with `GCR` on line 10.
- **Rationale:** Update operational workflow definitions to reflect current terms.

#### Proposed Change:
```markdown
<<<<
10: 2. **Workflow:** Every task follows: **SSU → PLAN → CLAIM → BUILD → PIU**. BUILD phases are: SHAPE → GATHER → EXECUTE → VERIFY → FINALIZE.
====
10: 2. **Workflow:** Every task follows: **SSU → PLAN → CLAIM → BUILD → GCR**. BUILD phases are: SHAPE → GATHER → EXECUTE → VERIFY → FINALIZE.
>>>>
```

---

## Ticket C

### 1. `scripts/bootstrap.js`
- **Goal:** Check `process.stdin.isTTY` at the start of `main()` and abort with code 1 if non-interactive. Replace `catch (err)` with `catch` where `err` is unused. Append `.catch()` block to the top-level `main()` call.
- **Rationale:** Avoid hanging in non-interactive environments (CI/CD) and conform to modern JavaScript style by removing unused exception parameters.

#### Proposed Change:
```javascript
<<<<
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
====
async function main() {
  if (!process.stdin.isTTY) {
    console.error("Error: stdin is not a TTY. Bootstrap must be run interactively.");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    return "";
  }
====
  } catch {
    return "";
  }
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    // Ignore read errors
  }
====
  } catch {
    // Ignore read errors
  }
>>>>
```
and
```javascript
<<<<
            try {
              fs.chmodSync(hookPath, 0o755);
            } catch (err) {
              // Ignore chmod error on systems where it is not supported
            }
====
            try {
              fs.chmodSync(hookPath, 0o755);
            } catch {
              // Ignore chmod error on systems where it is not supported
            }
>>>>
```
and
```javascript
<<<<
main();
====
main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
>>>>
```

---

### 2. `scripts/check-infra.js`
- **Goal:** Fix Windows drive letter casing bug in `isPathContained` by comparing paths case-insensitively on Windows. Replace `catch (err)` with `catch` where `err` is unused.
- **Rationale:** Prevent false path containment errors due to lowercase/uppercase drive letters on Windows, and remove unused variables.

#### Proposed Change:
```javascript
<<<<
function isPathContained(resolvedPath) {
  const normalizedPath = path.resolve(ROOT, resolvedPath);
  return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
}
====
function isPathContained(resolvedPath) {
  let normalizedPath = path.resolve(ROOT, resolvedPath);
  let rootPath = ROOT;
  if (process.platform === "win32") {
    normalizedPath = normalizedPath.toLowerCase();
    rootPath = rootPath.toLowerCase();
  }
  return normalizedPath === rootPath || normalizedPath.startsWith(rootPath + path.sep);
}
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    return null;
  }
====
  } catch {
    return null;
  }
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    // Ignore read errors
  }
====
  } catch {
    // Ignore read errors
  }
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    return [];
  }
====
  } catch {
    return [];
  }
>>>>
```
and
```javascript
<<<<
            } catch (err) {
              // Ignore git commit log failure
            }
====
            } catch {
              // Ignore git commit log failure
            }
>>>>
```

---

### 3. `scripts/upgrade-infra.js`
- **Goal:** Add `process.on('SIGINT', cleanup)` and `process.on('SIGTERM', cleanup)` hooks. Guard readline prompts by checking `process.stdin.isTTY` in `askQuestion()` (default to `'n'` if non-interactive). Fix Windows drive letter casing bug in `isPathContained`. Replace `catch (err)` with `catch` where `err` is unused. Append `.catch()` block to the top-level `main()` call.
- **Rationale:** Clean up the temporary clone directory if the process is terminated, default responses in non-interactive shells, fix drive letter bugs on Windows, and handle errors properly.

#### Proposed Change:
```javascript
<<<<
function isPathContained(resolvedPath) {
  const normalizedPath = path.resolve(ROOT, resolvedPath);
  return normalizedPath === ROOT || normalizedPath.startsWith(ROOT + path.sep);
}
====
function isPathContained(resolvedPath) {
  let normalizedPath = path.resolve(ROOT, resolvedPath);
  let rootPath = ROOT;
  if (process.platform === "win32") {
    normalizedPath = normalizedPath.toLowerCase();
    rootPath = rootPath.toLowerCase();
  }
  return normalizedPath === rootPath || normalizedPath.startsWith(rootPath + path.sep);
}
>>>>
```
and
```javascript
<<<<
// Helper to ask a question via terminal
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}
====
// Helper to ask a question via terminal
function askQuestion(query) {
  if (!process.stdin.isTTY) {
    return Promise.resolve("n");
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    return null;
  }
====
  } catch {
    return null;
  }
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    // Ignore read errors
  }
====
  } catch {
    // Ignore read errors
  }
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    return [];
  }
====
  } catch {
    return [];
  }
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    // If not a git repo or git not found, treat as clean/ignored
    return false;
  }
====
  } catch {
    // If not a git repo or git not found, treat as clean/ignored
    return false;
  }
>>>>
```
and
```javascript
<<<<
    } catch (err) {
      // Ignore SHA read error
    }
====
    } catch {
      // Ignore SHA read error
    }
>>>>
```
and
```javascript
<<<<
      } catch (e) {
        // Fallback to env
        operator = process.env.USERNAME || process.env.USER || "unknown";
      }
====
      } catch {
        // Fallback to env
        operator = process.env.USERNAME || process.env.USER || "unknown";
      }
>>>>
```
and
```javascript
<<<<
  } catch (err) {
    // Ignore cleanup error
  }
}

main();
====
  } catch {
    // Ignore cleanup error
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(1);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(1);
});

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(2);
});
>>>>
```
