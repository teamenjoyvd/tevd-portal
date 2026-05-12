-- 2605-FEAT-332 GCR: enforce at most one approved request per (event_id, role_label)
-- Prevents race conditions where two concurrent approve calls could both succeed.
CREATE UNIQUE INDEX idx_event_role_requests_one_approved_per_slot
  ON event_role_requests (event_id, role_label)
  WHERE (status = 'approved');
