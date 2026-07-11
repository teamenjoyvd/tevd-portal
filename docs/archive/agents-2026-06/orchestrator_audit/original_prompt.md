## 2026-06-05T22:53:04Z

Complete a read-only infrastructure audit of developer rules, workflows, configuration baselines, and Gotchas, producing a detailed audit report. No writes to codebase source files are permitted.

Working directory: c:/Users/fefence/Downloads/react/teamenjoyvd/tevd-portal
Integrity mode: development

## Requirements

### R1. Audit Baseline Drift
- Run the self-check script (`npm run agentic:check`).
- Document whether the tracked files match the baseline in `agentic.config.json` or if there is any drift.

### R2. Analyze Developer Rules & Gotchas
- Inspect all files in `.cursor/rules/`, `docs/ai/` (including `GOTCHAS.md`, `PLAN.md`, `RULES.md`, `BUILD.md`), and `CLAUDE.md`.
- **Workflow & Hard Constraints Check**: Identify direct conflicts or mismatches between the commands/constraints in `CLAUDE.md` and the detailed procedures defined in workflow files (`BUILD.md`, `PLAN.md`, `GCR.md`, `CLAIM.md`).
- **Syntax Check**: Validate that all Cursor `.mdc` files have valid glob patterns and frontmatter.
- **Redundancy & Conflict Check**: Identify duplicate or contradictory rules (e.g., instructions on state management, package managers, styling, or routing).
- **Tooling Alignment**: Verify that instructions align with the dependencies in `package.json` (Tailwind 4, Next.js 16, etc.) and highlight any legacy instructions.

### R3. Analyze Infrastructure Scripts
- Audit `scripts/` (e.g. `bootstrap.js`, `check-infra.js`, `upgrade-infra.js`, `validate-rules.js`).
- **Robustness & Error Handling**: Identify unhandled promise rejections, lack of try/catch blocks, or silent failures.
- **Cross-Platform Compatibility**: Check for potential Windows vs. Linux pathing issues (e.g., hardcoded `/` or `\\` separators) or line-ending mismatches.

### R4. Compile Audit Report
- Write a comprehensive markdown report documenting all findings.
- The report must be written to `.agents/audit_report.md` (which is git-ignored) and outputted in the final message.
- The report must classify findings into categories (Drift, Rules/Gotchas, Scripts) and prioritize recommendations (High, Medium, Low impact).

## Acceptance Criteria

### Audit & Verification
- [ ] No codebase source files (outside `.agents/` directory) are modified or written to.
- [ ] The file `.agents/audit_report.md` is successfully created.
- [ ] The report contains:
  - Baseline Drift Status (results of `npm run agentic:check`).
  - Analysis of direct conflicts/mismatches between `CLAUDE.md` commands and `BUILD`/`PLAN`/`GCR`/`CLAIM` workflow rules.
  - Cursor Rules (`.mdc`) syntax and configuration validation.
  - Identification of redundant, overlapping, or conflicting rules across `.cursor/rules/`, `docs/ai/`, and `CLAUDE.md`.
  - Alignment analysis of instructions against current dependencies in `package.json`.
  - Robustness, error handling, and cross-platform (Windows/Linux) audit of scripts.
  - A prioritized list of recommendations (High/Medium/Low impact).
