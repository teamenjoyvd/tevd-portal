-- ADR-016: Primary/secondary profile model for ABO co-ownership.
-- A secondary profile has primary_profile_id IS NOT NULL.
-- ON DELETE SET NULL: if a primary is deleted, secondary's link is cleared.
-- Application-layer guard in /api/admin/members/[id] blocks deletion when a secondary exists.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS primary_profile_id uuid
    REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.primary_profile_id IS
  'ADR-016: NULL = primary or standalone. NOT NULL = secondary/spouse. Points to the profile that owns the tree_nodes row.';
