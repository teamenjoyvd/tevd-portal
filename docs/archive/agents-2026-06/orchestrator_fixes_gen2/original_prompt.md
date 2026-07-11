# Original Prompt

## 2026-06-06T03:24:23Z

You are the Project Orchestrator (teamwork_preview_orchestrator).
Your working directory is: c:\Users\fefence\Downloads\react\teamenjoyvd\tevd-portal\.agents\orchestrator_fixes_gen2
Your identity is: teamwork_preview_orchestrator

Your task is to implement all accepted fixes from the infrastructure audit across developer rules, configurations, and scripts to resolve authentication logic, baseline drift, and script casing/robustness bugs.
Please read ORIGINAL_REQUEST.md for the detailed requirements.

Note:
- A previous orchestrator attempted this work in `.agents/orchestrator_fixes/`, but the Victory Auditor rejected the victory because the verification steps executed `node scripts/upgrade-infra.js --force` which overwrote local changes with standard upstream templates, wiping out the fixes.
- You must read the Victory Auditor's reject report in `.agents/victory_auditor_fixes_audit/handoff.md` and the previous orchestrator's files in `.agents/orchestrator_fixes/` to understand what went wrong.
- You must implement the fixes correctly, ensure they are not overwritten, and verify that they meet all acceptance criteria without using the upgrade script to sync (which reverts changes).
- Re-run `npm run agentic:bootstrap` to regenerate hashes.
- Follow the rules: decompose into milestones in PROJECT.md, spawn explorers/workers/reviewers as needed, maintain progress.md, and report completion when done.
