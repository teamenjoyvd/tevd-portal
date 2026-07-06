## Goal
Review CLAUDE.md + guardrails/ai/architecture/cursor-rules infrastructure; apply the approved doc fixes (findings 1-14, 16) from the review plan.

## Now
CLAIM complete for the test-infra ticket: GitHub issue #472, branch dev/2607-DEV-472 (from main), Design Checklist + ## Branch both on the issue body. Phantom-Inngest doc purge also complete and grep-verified clean.

## Next
1. BUILD #472 (separate invocation — anthropic-skills:build; BUILD does no design work, CLAIM already complete)
2. This worktree's local doc-fix edits (11+ files, uncommitted) are unrelated to #472's branch — if user wants them committed/pushed, confirm target branch first (never main; never push unless asked)
3. User-side: point Antigravity's config at root AGENTS.md / CLAUDE.md

## Constraints
- PLAN-mode review first, "do not edit any file... Wait for approval before touching anything" (approval granted via ExitPlanMode)
- "do not weaken or remove [Hard stops / CAPS constraints] as part of improving the kit"
- "Do not paraphrase or summarize any guardrail doc into your own words and act from that summary"
- Finding 15: user chose "Leave as-is" — DEBUG.md stays byte-identical to kit v1.0; do not trim
- Finding 17: user chose "Still used — wire it up" — AGENTS.md + PROJECT.md addendum authorized (supersedes the earlier "PROJECT.md untouched" scope line)
- No git commit/push requested this conversation

## Decisions
DECISION: Finding 9 implemented as option (a) — add Clerk-JWT-client constraint to CLAUDE.md `## Project` — plan recommended (a), approved unchanged.
DECISION: CONTEXT.md sections 1-3 replaced with pointers to REF.md sections 1-3 (finding 10; subsumes fixes 3 and 4) — the drift was the LOOKUP.md failure mode.
DECISION: ADR-009/ADR-006 get dated amendment/correction notes, not rewrites — DECISIONS.md header says records are never deleted.

## Facts
- Issue #472 "[2607-DEV-472] Add test infrastructure: Vitest + CI test job + first unit tests" — https://github.com/teamenjoyvd/tevd-portal/issues/472
- Branch dev/2607-DEV-472 created from main (sha 2e8a745, current main tip at CLAIM time)
- Worktree: .claude/worktrees/mystifying-almeida-2e1a2e, branch claude/mystifying-almeida-2e1a2e, tree clean at session start
- No middleware.ts, no lib/proxy.ts; Clerk middleware = root proxy.ts; next.config.ts has no proxy mention
- Actual vitals route dir: app/api/profile/vital-signs (no `vitals` dir)
- Existing but undocumented in REF.md: app/api/trips/route.ts, app/api/trips/[id]/messages/, app/api/admin/trips/[id]/messages/(+[messageId])
- Kit budget counts: 12 iron rules, core+footer 40 lines, 4 CAPS lines, all 7 F7 pairs byte-identical, DEBUG.md 1212 words
- README.md lacks `## Upgrade notes` (F15 target)
- Repo has no test runner (CONTEXT.md §4); CI = 4 parallel jobs (typecheck/lint/build/audit), node 22, on push+PR to main (.github/workflows/ci.yml)
- #322 (0272e7a, 2026-05-10) ripped out Inngest entirely: no inngest/postgres deps, no inngest/ or lib/db/ dirs, /api/inngest removed from lib/public-routes.ts; approve path = synchronous approve_member_verification RPC + Clerk updateUserMetadata + email in app/api/admin/members/verify/[id]/route.ts
- PHANTOM DOCS PURGED (2026-07-06): C4.md (External Systems Inngest bullet, Container 1 internal-structure/responsibilities/does-not-own/contract, Container 3 contract + does-not-own, Container 5 removed entirely — now correctly "Four deployable units"), REF.md (§1 lib/db/client.ts + inngest/* entries, §4 tree /inngest dir + /inngest/route.ts + /lib/db/client.ts, §6 /api/inngest row + verify-route description + RPC deprecated claim, §9 DATABASE_URL/INNGEST_* env rows, §5 approval_jobs marked orphaned), SYSTEM-MAP.mermaid (INN/INNGEST subgraph/I1-I3, CRON15/RECON/PATCHCLERK/INGSERVE — rewired DEC-approve straight to synchronous approve_member_verification RPC node). All backed by git evidence: 0272e7a "Rip out Inngest" (#322, 2026-05-10).
- STILL OPEN (not fixed, out of approved scope): REF.md §4/§6 `/api/events/[id]/register` is a phantom route — no such API route exists; real guest registration = `registerGuest()` server action (lib/actions/guest-registration.ts) via the public `/events/[eventId]/register` page. Same class of error as the vitals-path fix already done; flag for next doc-accuracy pass.
- Guest surface source of truth: lib/public-routes.ts PUBLIC_ROUTE_PATTERNS (16 entries) consumed by proxy.ts isPublicRoute; unauthenticated non-public /api/* gets 401, pages redirect /sign-in
- format.ts pins timeZone Europe/Sofia in code (CI UTC-safe); public-routes imports @clerk/nextjs/server createRouteMatcher

## Done
Review phase — RESULT: 17 findings + informational list, plan approved (C:\Users\fefence\.claude\plans\before-doing-anything-else-cheerful-naur.md). Evidence: grep/diff outputs in session (F7 pairs 1-hit-each; ls confirms proxy.ts root; diff PROJECT-NOTES/REFACTOR IDENTICAL).
Fixes applied — RESULT: 11 files modified + docs/STATE.md created; 52 insertions/117 deletions; all plan verification greps pass (F7 pairs still byte-identical; C4 stale-pattern lines 0; auth.mdc middleware-permitted 0; REF profile/vitals 0, vital-signs 2; README Upgrade notes 1; CLAUDE.md kit-zone CAPS still 4).
NOTED (not done): docs/archive/CLAUDE.md.bak still contains 2 `add <n>` occurrences — archived file, left untouched.
Finding-5 correction — RESULT: original FLOWS.md text was right all along (Inngest removed in #322); my Inngest rewrite reverted same session, net FLOWS diff = header date + one history-note sentence. Evidence: git diff quoted in transcript; git log -S inngest -> 0272e7a "Rip out Inngest".
Phantom-Inngest purge — RESULT: C4.md/REF.md/SYSTEM-MAP.mermaid corrected; final grep shows only 5 intentional "removed in #322" notes remain repo-wide; mermaid subgraph/end counts balanced 15/15 post-edit.

## Open items
- Finding 15 CLOSED: user decision = leave DEBUG.md as-is; report the F11 overage upstream to the kit source if desired
- Finding 17 CLOSED in-repo (AGENTS.md + PROJECT.md addendum); remaining user-side step: configure Antigravity to load AGENTS.md/CLAUDE.md
- Pattern B RLS remediation (SEQ261-265, ADR-011) status unknown from docs alone

## Failed attempts
(none)
