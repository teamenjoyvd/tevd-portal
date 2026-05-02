-- Rename visibility_roles → access_roles on calendar_events and trips
ALTER TABLE calendar_events RENAME COLUMN visibility_roles TO access_roles;
ALTER TABLE trips RENAME COLUMN visibility_roles TO access_roles;
