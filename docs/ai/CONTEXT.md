# CONTEXT.md — teamenjoyVD Portal
> Last updated: 2026-07-06.
> **Read at GATHER start. Never read at SSU.**
> For reference tables (schema, design system, i18n, env vars, API map): `docs/ai/REF.md` §4-§11 — see its own Section Map.
> For architecture, flows, and decisions: `docs/architecture/`
> `docs/ai/LOOKUP.md` no longer exists — do not recreate it. It was archived once (2026-05) as superseded by REF.md, recreated anyway, drifted from REF.md again within a month, and was deleted for good on 2026-06-20. All reference content lives in REF.md now.

---

## Section Map — read only what the ticket needs

| Section | Read when ticket touches |
|---|---|
| §1-§3 → `docs/ai/REF.md` §1-§3 | Key files & patterns, navigation, admin pages |
| §4 CI | `types/supabase.ts`, `ci.yml` |
| §5 Releases | Release history, pending issues |

---

## 1-3. Key Files & Patterns / Navigation / Admin Pages — moved to REF.md

Removed from this file on 2026-07-06. These sections duplicated `docs/ai/REF.md` §1-§3 and had drifted:
this file still said `lib/supabase/service.ts` is a singleton (the singleton was removed in #307 — it
returns a fresh client per call), still prescribed `window.confirm` for deletes (all deletes use
`AlertDialog`), and was missing the Event Reminders nav entry and admin pages. That is the same
duplication failure that killed LOOKUP.md twice.

Read `docs/ai/REF.md` §1 (Key Files & Patterns), §2 (Navigation), §3 (Admin Pages) instead.
Do not re-add reference content here — REF.md is the single canonical reference doc.

---

## 4. CI

On every push to `main`: typecheck (`npx tsc --noEmit`) → lint → build → `npm audit` (audit is non-blocking, `|| true`). Workflow: `.github/workflows/ci.yml`. No test job exists — there is no test runner in the repo.

Types are maintained exclusively via `Supabase:generate_typescript_types` MCP tool after every migration. CLI not installed. No drift diff step.

Fix flow: `generate_typescript_types` → write `types/supabase.ts` → `tsc --noEmit` → commit.

---

## 5. Release History

> Not maintained here — always stale. Check GitHub commit history or Vercel deployment history for the current state.
> For open issues: `GET /repos/teamenjoyvd/tevd-portal/issues?state=open`
