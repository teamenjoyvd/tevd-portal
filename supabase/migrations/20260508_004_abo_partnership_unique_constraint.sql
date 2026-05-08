-- ADR-016: Enforce max-one-secondary-per-primary at the database level.
-- A UNIQUE index on primary_profile_id satisfies this constraint while still
-- allowing unlimited NULL values (standalone/primary accounts).
-- PostgreSQL UNIQUE indexes treat NULLs as distinct, so this is safe.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_primary_profile_id_key
  ON profiles (primary_profile_id)
  WHERE primary_profile_id IS NOT NULL;

COMMENT ON INDEX profiles_primary_profile_id_key IS
  'ADR-016: Enforces max one secondary per primary. NULLs excluded so standalone profiles are unaffected.';
