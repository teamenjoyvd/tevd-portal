## Goal
BUILD issue #681 (2607-DEV-681, branch `dev/2607-DEV-681`): delete 14 unreferenced dead stubs under `app/admin/**` plus the orphaned `app/(dashboard)/admin/layout.tsx` guard, collapse two double-hop redirects (`howtos`, `payable-items`), and correct the `docs/ai/REF.md` route table.

## Now
BUILD code-complete at `90ed666` (19 files: 14 deleted, 5 edited). All local gates green — see Done. Not pushed; no push has been requested this session.

## Next
1. `/code-review low` on the diff, fix findings locally.
2. Ask the user for a push grant; then push `dev/2607-DEV-681` and open the PR as DRAFT with `Closes #681`.
3. CI green + Vercel preview READY, then mark ready for the single CodeRabbit pass.
4. No migrations — no `migrate-prod` gate. GCR tail: remove the `docs/CLAIMS.md` row, close #681.

## Constraints
- Never push to `main`; `dev/2607-DEV-681` only.
- No `git push` unless the user asks for a push in this conversation (quote required). Not yet asked this session.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row + `docs/STATE.md` updates into this PR — no standalone cleanup PR.
- Change only what the DoD requires; log other findings as NOTED.

## Decisions
- `app/admin/operations/page.tsx` is KEPT — it is a live redirect target at `/admin/operations`. Only its `components/` subtree goes.
- `payable-items` redirects to `/admin/items` (the real home of items), not to `/admin/payments` where the old chain landed.

## Facts
- C14 deletion greps run against `1aa6d72`: bare names repo-wide hit only self-references, two historical comments (`lib/types/payments.ts:2`, `lib/types/items.ts:2`), and live twins at *different* paths (`app/admin/payments/components/{LogPaymentForm,PendingPaymentsSection}.tsx`, `app/admin/items/{new,[id]}/components/Item*Form.tsx`). Quoted-name grep: no matches. No barrel `index.ts*` exists under `app/admin`.
- `app/(dashboard)/admin/layout.tsx` is the only file under `app/(dashboard)/admin/` — guards zero routes.
- `middleware.ts` does not exist (routing-touching ticket check).
- Redirect chains confirmed by Read: `howtos -> /admin/guides -> /admin/content?tab=guides`; `payable-items -> /admin/operations?tab=items -> /admin/payments` (drops the param, wrong section).

## Done
- CLAIM complete: issue #681 has `## Design Checklist` (four checked) + `## Branch`; branch cut; `docs/CLAIMS.md` row registered in `1aa6d72` (merged #678 row pruned in the same commit).
- BUILD code-complete, commit `90ed666`: 14 files deleted, `app/admin/howtos/page.tsx` + `app/admin/payable-items/page.tsx` + `docs/ai/REF.md` edited. 19 files, 30 insertions / 108 deletions — well inside the EST.
- Verified locally at `90ed666`: `npx tsc --noEmit` exit 0; `npm run build` compiled successfully; `npm run lint` 0 errors / 476 warnings (baseline 477 — one fewer, the deleted `BlockEditor` stub's; none new); `npm test` 17 files / 211 tests passed.
- DoD invariants re-checked after deletion: `find app -name layout.tsx -path "*admin*"` -> `app/admin/layout.tsx` only (exactly one admin guard); `middleware.ts` absent; the deleted-name grep returns no import sites (only two provenance comments and this branch's own CLAIMS row).

## Open items
- `app/admin/components/LangTabs.tsx` has zero consumers repo-wide and a false docstring ("Used by AnnouncementsTab"). Same class of debt, carried over from #678; NOT in #681's DoD. NOTED, not done.
- `docs/ai/REF.md:109` prose ("Operations payments tab: Log Payment Drawer…") describes a tab that now lives at `/admin/payments`. Outside the DoD's named lines. NOTED, not done.
- `BottomNav.tsx` dead stub (GOTCHAS row 31) — outside the admin tree, out of scope per the issue.

## Failed attempts
- ATTEMPT 1 [L1]: `npm run build` after the 14 deletions + 2 redirect edits -> `# Fatal process out of memory: Zone`, `Next.js build worker exited with code: 2147483651`. Not a compile error. Environment at the time: 8.5 GB total / 2.3 GB free; `scripts/build.js:14` requests `--max-old-space-size=4096`. Next step: prove pre-existing by building the clean tree at `1aa6d72` (detached) rather than asserting it.
  RESOLVED, not reproducible: the control build at `1aa6d72` (detached, after `rm -rf .next`) succeeded, so it was NOT proven pre-existing; the same branch then built clean at `90ed666` under the same `rm -rf .next` conditions. Two conditions differed from the failing run — a stale `.next` was present, and `tsc`+`lint` had just run in the same shell against 2.3 GB free. Treat `rm -rf .next` as the first response if it recurs; do not raise `--max-old-space-size` (the OS, not the V8 heap, was the limit — "Fatal process out of memory: Zone" with 4096 already requested).
