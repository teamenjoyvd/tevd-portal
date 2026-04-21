-- [2604-CHORE-89] Library consolidation: DB + infrastructure
-- 1. Add slug column to announcements (nullable, unique — existing rows get null, admin enforces going forward)
ALTER TABLE public.announcements
  ADD COLUMN slug text UNIQUE;

-- 2. Rename access_level → access_roles on announcements
ALTER TABLE public.announcements
  RENAME COLUMN access_level TO access_roles;

-- 3. Add is_active to links
ALTER TABLE public.links
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;
