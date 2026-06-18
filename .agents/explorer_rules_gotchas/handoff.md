# Handoff Report — Rules & Gotchas Infrastructure Audit

This report presents the findings from the Read-Only Infrastructure Audit conducted for Milestone 2: Rules & Gotchas Audit.

---

## 1. Observation

### Observation 1: Middleware File Mismatch & Deactivation
- **`CLAUDE.md` (Line 63):**
  > `- **NEVER create \`middleware.ts\`.** Auth lives in \`proxy.ts\`.`
- **`docs/ai/RULES.md` (Lines 10-11):**
  > `- **NEVER** create \`middleware.ts\` in the project root.`
- **`docs/ai/GOTCHAS.md` (Line 7):**
  > `| \`middleware.ts\` | NEVER. Use \`proxy.ts\`. |`
- **`docs/architecture/DECISIONS.md` (Lines 207, 224):**
  > `The middleware file is named \`proxy.ts\`, not \`middleware.ts\`. This is configured explicitly in \`next.config.ts\`... \`next.config.ts\` explicitly points to \`proxy.ts\``
- **`next.config.ts` (Lines 1-30):**
  There is no reference to `proxy.ts` or custom middleware configuration in `next.config.ts`.
- **`.cursor/rules/auth.mdc` (Line 12):**
  > `- Root \`middleware.ts\` is permitted **ONLY** for Clerk's \`clerkMiddleware()\` — no other logic.`
- **File System Check:**
  `find_by_name` on `*middleware.ts` returned `0` matches. Root level file `proxy.ts` exists.

### Observation 2: Tooling Warm-up Mismatch (Nonexistent Tool)
- **`CLAUDE.md` (Lines 84-87):**
  > `1. Tool warm-up (before anything else):`
  > `   - tool_search("get file contents github")`
  > `   - tool_search("branch issue pull request create")`
- **Agent Toolkit:**
  The tool directory and MCP server configuration contain no tool called `tool_search`.

### Observation 3: PLAN Stage File Writes Mismatch
- **`CLAUDE.md` (Line 74):**
  > `- SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session. PLAN does no writes of any kind. CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.`
- **`docs/ai/PLAN.md` (Line 3, 20):**
  > `Pure thinking mode. **Zero writes of any kind** to the codebase or GitHub.`
  > `... (Exception: If running as Antigravity, also write/update the \`implementation_plan.md\` artifact in the brain directory following this format).`

### Observation 4: Syntax & Glob Errors in Cursor Rules
- **`.cursor/rules/auth.mdc` (Line 3):**
  > `globs: ["app/api/**/*.ts", "middleware.ts", "lib/proxy.ts"]`
  There is no file or folder named `lib/proxy.ts`. The proxy file resides at `proxy.ts` in the root.
- **`.cursor/rules/database.mdc` (Line 12):**
  > `- RLS policies must ONLY reference Pattern A helper functions which live in \`20260520_002_rls.sql\`: get_my_clerk_id(), get_my_profile_id().`
  No migration file named `20260520_002_rls.sql` exists in `supabase/migrations/`. The helper functions `get_my_clerk_id()` and `is_admin()` are actually defined in `20260315000000_baseline.sql` (Line 361, 381).

### Observation 5: Layout Decision Rules Discrepancy
- **`CLAUDE.md` (Line 72), `RULES.md` (Lines 55-57), and `.cursor/rules/frontend.mdc` (Lines 15-26):**
  > `Default: Single responsive layout... Dual layout (separate files) is required only for: tables with 5+ columns, complex touch vs mouse drag-and-drop, persistent sidebar layouts, or interactive canvases/maps/rich-text editors.`
- **`docs/architecture/DECISIONS.md` (ADR-009 "Active"):**
  > `Every page that has meaningfully different desktop and mobile UX uses two separate complete layout trees. No hybrid responsive layout.`

### Observation 6: Undocumented Rollback Comment Migration Constraint
- **`scripts/validate-rules.js` (Lines 171-174):**
  > `if (!/-- ROLLBACK:/i.test(content)) {`
  > `  warn(\`Migration \${file} is missing a -- ROLLBACK: comment.\`);`
- **Rule Documents:**
  No mention of `-- ROLLBACK:` comments exists in `CLAUDE.md`, `RULES.md`, `GOTCHAS.md`, or `.cursor/rules/database.mdc`.
- **Validation Run:**
  Running `npm run agentic:validate` produces 80 warnings for missing `-- ROLLBACK:` comments in existing migration files.

### Observation 7: Tailwind v4 Alignment & Inactive `tailwind.config.ts`
- **`package.json` (Lines 59, 68):**
  > `"@tailwindcss/postcss": "^4.2.1",`
  > `"tailwindcss": "^4"`
- **`postcss.config.mjs` (Line 3):**
  > `"@tailwindcss/postcss": {},`
- **`app/globals.css` (Line 1):**
  > `@import 'tailwindcss';`
  No `@config` directive importing `tailwind.config.ts` exists.
- **`tailwind.config.ts`:**
  Exists at root but is ignored by Tailwind v4 because Tailwind v4 does not support `.config.ts` files automatically without explicit config directives.
- **`styles/brand-tokens.css` (Lines 5-13):**
  Declares colors using non-standard variable names: `--brand-forest: #2d332a;` (not `--color-brand-forest`).
- **Codebase grep:**
  We found that the codebase uses inline styles with `var(--brand-forest)` and arbitrary Tailwind values like `bg-[var(--brand-forest)]` rather than standard utility classes like `bg-brand-forest`.

---

## 2. Logic Chain

1. **Next.js Middleware Execution:**
   - Next.js only recognizes files named exactly `middleware.ts` or `middleware.js` (optionally under `src/`) to run edge middleware.
   - The project strictly forbids `middleware.ts` in all core markdown rules.
   - The claims in `DECISIONS.md` that Next.js points to `proxy.ts` via `next.config.ts` are false, as no such setting exists in `next.config.ts` or the Next.js API.
   - Therefore, `proxy.ts` is never executed. Gating/edge route protection is completely inactive.
   - Cursor rule `auth.mdc` contradicts the markdown rules by permitting `middleware.ts`, causing automated agents to run into hard constraint violations if they try to create it to fix auth.

2. **Tool Warm-up Failure:**
   - `CLAUDE.md` requires agents to call `tool_search`.
   - The agent toolkit does not have this tool.
   - Therefore, any script or agent trying to strictly execute SSU warm-up steps will fail.

3. **PLAN Stage File Writes:**
   - `CLAUDE.md` specifies that the PLAN stage must perform zero writes.
   - `PLAN.md` has an exception allowing Antigravity to write/update `implementation_plan.md` in the `.agents/` folder.
   - This contradiction could cause automatic validation gates enforcing "no writes in PLAN mode" to block legitimate agent behaviors.

4. **Cursor Rules Glob & Reference Drift:**
   - Glob patterns in `.cursor/rules/auth.mdc` point to a non-existent path `lib/proxy.ts` instead of the root `proxy.ts`.
   - `.cursor/rules/database.mdc` directs developers to inspect `20260520_002_rls.sql` for RLS helpers, but this file does not exist, as helpers live in `20260315000000_baseline.sql`.
   - These errors prevent Cursor rules from matching files correctly and lead developers to look for non-existent references.

5. **Layout Contradiction:**
   - ADR-009 mandates "No hybrid responsive layout," while `RULES.md` and `frontend.mdc` specify "Default: Single responsive layout."
   - Because ADR-009 is still marked "Active" in `DECISIONS.md`, developers receive conflicting directions on whether to build responsive layouts or dual-file layouts.

6. **Migration Script Warnings:**
   - The rule validator script warns on missing `-- ROLLBACK:` comments, which is not documented in any rule handbook.
   - This leads to unexpected linting/validation failures for developers.

7. **Tailwind CSS v4 & Theme Misalignment:**
   - Tailwind v4 ignores `tailwind.config.ts`.
   - Because `brand-tokens.css` defines colors with `--brand-forest` instead of `--color-brand-forest`, Tailwind v4 does not generate utility classes like `bg-brand-forest`.
   - This forces developers to use verbose syntax (e.g. `bg-[var(--brand-forest)]`), contradicting standard utility-first styling paradigms.

---

## 3. Caveats

- We did not perform write operations to fix these issues, in strict compliance with the **read-only investigation** constraint.
- The behavior of Next.js middleware in Next.js 16 was assumed to align with standard Vercel Next.js framework documentation, which does not allow routing middleware filenames other than `middleware`.

---

## 4. Conclusion

The audit has revealed significant conflicts and alignment issues between the project rules, actual framework behaviors, and tool setups. The most severe finding is that **middleware-level Clerk authentication is completely disabled** due to the naming of the middleware file as `proxy.ts`. Additionally, Tailwind CSS v4 is misconfigured, causing the `tailwind.config.ts` file to be completely ignored and preventing the use of standard custom color utility classes.

### Summary of Recommendations

#### 🔴 High Impact (Critical Security & Core Mismatch)
1. **Unify and Rename Middleware:**
   Rename `proxy.ts` to `middleware.ts` so Next.js executes the auth middleware. Update the hard constraints in `CLAUDE.md`, `RULES.md`, and `GOTCHAS.md` to permit a single `middleware.ts` in the root containing only `clerkMiddleware()`. Update `.cursor/rules/auth.mdc` to reflect this single allowed file.
2. **Fix `auth.mdc` Glob:**
   Update `auth.mdc` to target the correct path of the proxy/middleware.
3. **Correct Tailwind CSS v4 Theme Registration:**
   Rename variables in `styles/brand-tokens.css` to use the `--color-` prefix (e.g. `--color-brand-forest` instead of `--brand-forest`). Delete the redundant `tailwind.config.ts` file to avoid developer confusion.

#### 🟡 Medium Impact (Process & Rule Validation)
4. **Remove `tool_search` from SSU:**
   Remove the nonexistent `tool_search` command warm-up requirement from `CLAUDE.md` to prevent agent failures.
5. **Update ADR-009 Status:**
   Mark ADR-009 in `docs/architecture/DECISIONS.md` as "Superseded" and link it to the new quantitative layout rules defined in `RULES.md` and `frontend.mdc`.
6. **Correct Database Rule Reference:**
   Update `database.mdc` to reference `20260315000000_baseline.sql` instead of the non-existent `20260520_002_rls.sql` file.
7. **Document Rollback Constraint:**
   Add a note about the `-- ROLLBACK:` comment requirement in `GOTCHAS.md` or `database.mdc` so that developers write migrations that conform to `scripts/validate-rules.js`.

#### 🟢 Low Impact (Nomenclature & Minor Inconsistencies)
8. **Clarify PLAN Stage Writes:**
   Update `CLAUDE.md` to explicitly state that local metadata writes inside the `.agents/` directory (like `implementation_plan.md`) are permitted during the PLAN phase.
9. **Fix Typos:**
   Rename `PIU` to `GCR` in `docs/ai/GEMINI.md` to align with `CLAUDE.md` and `docs/ai/GCR.md`.

---

## 5. Verification Method

### 1. Verification of Rule Mismatch Diffs
Inspect the following files directly:
- `CLAUDE.md` (line 63)
- `docs/ai/RULES.md` (lines 10-11)
- `docs/ai/GOTCHAS.md` (line 7)
- `docs/architecture/DECISIONS.md` (ADR-006, line 207)
- `.cursor/rules/auth.mdc` (line 3, line 12)
Verify that the middleware filenames and paths conflict.

### 2. Validation Script Check
Run the validator script using npm:
```bash
npm run agentic:validate
```
Check that it outputs warnings regarding migration rollbacks and branch naming, but reports zero middleware files found.

### 3. Middleware Inactivity Proof
Examine `next.config.ts`. Confirm it lacks any middleware redirection logic. Verify that standard Next.js documentation holds true: files named `proxy.ts` at the root of a Next.js App Router project are ignored during build and dev.
