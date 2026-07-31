## Goal
BUILD issue #681 (2607-DEV-681, branch `dev/2607-DEV-681`): delete 14 unreferenced dead stubs under `app/admin/**` plus the orphaned `app/(dashboard)/admin/layout.tsx` guard, collapse two double-hop redirects (`howtos`, `payable-items`), and correct the `docs/ai/REF.md` route table.

## Now
BUILD starting from `1aa6d72`. Baseline captured: `npx tsc --noEmit` clean, `npm run lint` 0 errors / 477 warnings.

## Next
1. Delete the 14 stubs; re-run `tsc`.
2. Edit the two redirect pages + `docs/ai/REF.md` lines 106/107/145; run `tsc`, `npm run build`, `npm run lint`.
3. `/code-review low` on the diff, fix findings locally.
4. Ask the user before any push; then draft PR with `Closes #681`.

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

## Open items
- `app/admin/components/LangTabs.tsx` has zero consumers repo-wide and a false docstring ("Used by AnnouncementsTab"). Same class of debt, carried over from #678; NOT in #681's DoD. NOTED, not done.
- `docs/ai/REF.md:109` prose ("Operations payments tab: Log Payment Drawer…") describes a tab that now lives at `/admin/payments`. Outside the DoD's named lines. NOTED, not done.
- `BottomNav.tsx` dead stub (GOTCHAS row 31) — outside the admin tree, out of scope per the issue.

## Failed attempts
- ATTEMPT 1 [L1]: `npm run build` after the 14 deletions + 2 redirect edits -> `# Fatal process out of memory: Zone`, `Next.js build worker exited with code: 2147483651`. Not a compile error. Environment at the time: 8.5 GB total / 2.3 GB free; `scripts/build.js:14` requests `--max-old-space-size=4096`. Next step: prove pre-existing by building the clean tree at `1aa6d72` (detached) rather than asserting it.
