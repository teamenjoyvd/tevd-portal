-- ROLLBACK: none. Recreating the role would mint a NEW credential, not restore the
-- old one (the password is not recoverable and is deliberately not recorded here).
-- If the scraper is ever resumed it needs its own Supabase project, not a role on
-- this database — see the DECIDE note in docs/STATE.md.
-- ============================================================
-- [2608-DEV-694] Drop the out-of-band price_checker role
--
-- `price_checker` was a LOGIN role with a password set and no expiry, created by
-- hand on the DEV project — no migration, no repo reference, invisible to code
-- review. It held arwdDxtm on every table in `public` (308 grants across 44
-- relations) plus USAGE on the schema, and an ALTER DEFAULT PRIVILEGES rule listed
-- it beside anon/authenticated/service_role for TABLES and SEQUENCES, so every
-- table this repo would ever create was auto-granted to it.
--
-- Origin: the sibling private repo teamenjoyvd/amway-price-checker, which pointed
-- its DATABASE_URL at this project. That integration was never functional — the
-- scraper's tables (master_products, source_products, ...) do not exist in this
-- schema, so the role backed a connection string that could not work. It was used
-- exactly once, 2026-07-29, for a bare client handshake: type-catalog bootstrap,
-- identity probe, an existence check for two named tables, then a list-databases
-- 4.5 minutes later. Zero queries against any business table, ever.
--
-- DEV-only: the role never existed on production, so the guard below makes this a
-- no-op there. The privileges were already revoked and the role dropped on DEV
-- out of band on 2026-08-05 (the credential was live and the role name had been
-- published in docs/STATE.md on the public repo, so the window was closed
-- immediately rather than left open for the duration of this PR). This migration
-- is the durable, versioned record of that change and the guarantee that any
-- database restored or branched from an older snapshot gets the same treatment.
--
-- DROP OWNED BY is deliberately NOT used: it requires membership in the target
-- role, which `postgres` does not have on Supabase (it is not superuser), and the
-- privileges were fully enumerable and confined to `public` anyway. Verified on
-- DEV after applying: 0 rows in each of pg_roles, pg_default_acl, the
-- role_table_grants view, and pg_namespace.nspacl; 41 tables intact; the four
-- stock roles untouched. Re-running the block a second time succeeded as a no-op.
--
-- NOTE: this repo has no other role DDL — see docs/guardrails/PROJECT.md. This is a
-- one-off cleanup, not a new convention for managing roles.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'price_checker') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM price_checker;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM price_checker;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM price_checker;

    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM price_checker;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM price_checker;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM price_checker;
    REVOKE ALL ON SCHEMA public FROM price_checker;

    DROP ROLE price_checker;
  END IF;
END $$;
