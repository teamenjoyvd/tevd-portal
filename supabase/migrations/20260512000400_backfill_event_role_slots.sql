-- 2605-FEAT-332: Backfill event_role_slots from existing event_role_requests
-- Creates one slot per distinct (event_id, role_label) pair.
-- Safe to re-run — ON CONFLICT DO NOTHING.

INSERT INTO event_role_slots (event_id, role_label)
SELECT DISTINCT event_id, role_label
  FROM event_role_requests
ON CONFLICT (event_id, role_label) DO NOTHING;

-- Also seed slots from calendar_events.available_roles for events
-- that have no requests yet (so the popup can display empty slots).
INSERT INTO event_role_slots (event_id, role_label)
SELECT e.id, unnest(e.available_roles)
  FROM calendar_events e
 WHERE array_length(e.available_roles, 1) > 0
ON CONFLICT (event_id, role_label) DO NOTHING;
