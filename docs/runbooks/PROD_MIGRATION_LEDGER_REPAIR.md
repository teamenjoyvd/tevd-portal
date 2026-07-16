# Runbook: Prod `schema_migrations` ledger audit + repair (#570)

## 2026-07-16 audit result (read-only, via Management API — no link, no writes)

**Ledger:** prod has **162 rows, none derived from filenames** — MCP recorded apply-time timestamps, so only 6 of 162 coincide with the 115 local file versions. Per-row `migration repair` is pointless at this ratio; the repair is a **full ledger rewrite** (delete all rows, insert the 115 file-derived versions). Generated script: `prod_ledger_rewrite.sql` (115 inserts; `20260716000100` deliberately left pending for the gated workflow to apply). Ledger writes touch only `supabase_migrations.schema_migrations` — never the schema itself.

**Schema:** full public-schema inventory diff prod-vs-DEV (DEV = known file-state): **23 mismatches out of ~750 objects**, all reconciled by migration `20260716000100_normalize_prod_schema_drift.sql`:
- prod missing: `settings.created_at/updated_at`, `profiles_primary_profile_id_key` unique index (0 duplicate rows verified), the 4 file-state `spouse_link_requests` policies (prod ran an older 2-policy MCP set), `idx_spouse_link_requests_requester`
- prod-only, retro-fitted into the file (kept): `fn_guard_abo_number_null` + trigger, `tree_nodes_path_btree_idx`, `notifications_*` indexes, `idx_spouse_link_requests_claimed_primary`, unique `social_posts_single_pinned`
- prod-only, dropped: `guest_registrations_event_id_idx` + `idx_event_share_links_profile` (files dropped them in `20260504000002`; prod never received the drop)

**Root-cause finding:** the old `YYYYMMDD_NNN` filename rule truncates to a bare-date CLI version and collides across same-day files — it caused the DEV "truncated versions" incident. Convention is now `YYYYMMDD00NN00` (14-digit); enforced by the Claude Code hook.

**Execution order (strict):** (1) apply the ledger rewrite below → (2) merge the `20260716000100` PR → (3) approve the migrate-prod run, which applies exactly that one migration → (4) re-run the inventory diff; expect 0 mismatches.


**Who:** a human with prod credentials. **When:** once, before the first gated `migrate-prod.yml` run is approved. The workflow must not `db push` against prod until step 4 verifies clean.

Prod ref: `ynykjpnetfwqzdnsgkkg`. This is the same procedure that repaired the DEV ledger on 2026-07-14 (see docs/STATE.md Facts), so the mechanism is proven.

> The "never link prod from a dev machine" constraint is suspended for this runbook only — it is an explicitly prod-targeted ticket (#570). Unlink when done.

## 1. Read-only audit (no writes)

```sh
supabase link --project-ref ynykjpnetfwqzdnsgkkg   # prompts for SUPABASE_DB_PASSWORD
supabase migration list --linked
```

Capture the output. Three drift classes to look for:

| Class | Symptom | Fix (step 3) |
|---|---|---|
| Applied but unrecorded | schema object exists, no remote ledger row | `migration repair --status applied <version>` |
| Phantom / truncated row | remote row with no matching local file (e.g. the truncated `20260707/09/10` pattern seen on DEV) | `migration repair --status reverted <bad>` then `--status applied <correct>` |
| File never applied | local file, no remote row, object absent | leave pending — the gated workflow will apply it |

## 2. Schema-vs-files check

```sh
supabase db diff --linked
```

Empty diff = the migration files fully describe prod. Non-empty = schema was changed outside the files (MCP-era DDL): retro-fit an `IF NOT EXISTS`-safe migration file for it (normal `YYYYMMDD_NNN_description.sql` naming) or, if a file already exists, ledger-repair it as applied.

## 3. Repair

```sh
supabase migration repair --status applied <version> [...]
supabase migration repair --status reverted <version> [...]
```

Repair only touches the ledger table — it never runs SQL. Re-run `supabase migration list --linked` after each batch until local and remote columns match for every row.

## 4. Verify (gate for the workflow)

```sh
supabase db push --dry-run --linked
```

Must report exactly the expected pending set (usually: none). Paste the output into #570 before approving the first `migrate-prod` run.

## 5. Cleanup

```sh
supabase link --project-ref iymwxdewcpvpjgzewtzk   # re-link the default DEV project
```

From this point on, prod DDL goes exclusively through `migrate-prod.yml` — CLI is the single ledger writer; MCP `apply_migration` is DEV-only.
