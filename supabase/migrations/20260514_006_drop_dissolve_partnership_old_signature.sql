-- Migration: 20260514_006_drop_dissolve_partnership_old_signature
-- GCR C2: drop the old single-arg signature entirely rather than leaving
-- a broken stub that would cause a NOT NULL violation if called accidentally.
-- The REVOKE in _005 prevented execution but left the function in the catalog.

DROP FUNCTION IF EXISTS dissolve_partnership(uuid);
