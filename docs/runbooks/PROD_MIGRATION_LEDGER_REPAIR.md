# Runbook: Prod `schema_migrations` ledger audit + repair (#570)

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
