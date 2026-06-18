# Infrastructure Audit Plan

This plan details the steps to perform a read-only infrastructure audit of developer rules, workflows, configuration baselines, and Gotchas for the `tevd-portal` project.

## Objective
Produce a detailed, comprehensive audit report saved at `.agents/audit_report.md` without modifying any codebase source files.

## Decomposition of Audit Work
We will decompose the work into the following phases:

1. **Phase 1: Environment Baseline Check (R1)**
   - Run `npm run agentic:check`.
   - Inspect `agentic.config.json` to understand tracked configuration and files.
   - Document any drift between the actual files and baseline.

2. **Phase 2: Developer Rules, Workflows & Gotchas Audit (R2)**
   - Inspect files in:
     - `.cursor/rules/`
     - `docs/ai/` (including `GOTCHAS.md`, `PLAN.md`, `RULES.md`, `BUILD.md`, `GCR.md`, `CLAIM.md`)
     - `CLAUDE.md`
     - `package.json` (for dependencies and tooling)
   - Perform the following checks:
     - **Workflow & Hard Constraints Check**: Check for mismatches/conflicts between `CLAUDE.md` commands/constraints and workflow files.
     - **Syntax Check**: Validate glob patterns and frontmatter in `.mdc` files in `.cursor/rules/`.
     - **Redundancy & Conflict Check**: Identify duplicate or contradictory rules (state management, package managers, styling, routing).
     - **Tooling Alignment**: Verify instructions against actual package.json dependencies (Tailwind 4, Next.js 16, etc.).

3. **Phase 3: Infrastructure Scripts Audit (R3)**
   - Audit scripts in the `scripts/` directory (`bootstrap.js`, `check-infra.js`, `upgrade-infra.js`, `validate-rules.js`).
   - Identify robustness/error handling issues (unhandled promise rejections, lack of try/catch, silent failures).
   - Identify cross-platform issues (Windows vs. Linux separators, line-ending mismatches).

4. **Phase 4: Synthesis & Reporting (R4)**
   - Consolidate all findings from Phase 1, 2, and 3.
   - Classify findings into categories: Drift, Rules/Gotchas, Scripts.
   - Categorize recommendations by priority: High, Medium, Low impact.
   - Write the final report to `.agents/audit_report.md`.

## Execution Topology
- **Subagent 1: Explorer Agent (Baseline & Scripts Audit)**
  - Path: `.agents/explorer_1`
  - Task: Run baseline checks, audit infrastructure scripts for error handling and cross-platform issues.
- **Subagent 2: Explorer Agent (Rules & Gotchas Audit)**
  - Path: `.agents/explorer_2`
  - Task: Inspect `.cursor/rules/`, `docs/ai/`, `CLAUDE.md`, and `package.json` for syntax, workflows, conflict, and dependency alignment.
- **Orchestrator**:
  - Path: `.agents/orchestrator_audit`
  - Task: Synthesize subagent findings, draft the final report, review it, and save to `.agents/audit_report.md`.
