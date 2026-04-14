-- [2604-BUG-001] Add is_active to member_vital_signs
-- Replaces row-presence toggle with an explicit boolean.
-- Existing rows are considered active (DEFAULT true).

ALTER TABLE member_vital_signs
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;
