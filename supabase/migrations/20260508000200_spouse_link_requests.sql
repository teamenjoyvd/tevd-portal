-- ADR-016: Spouse link request flow.
-- A guest submits a request claiming they share an ABO with an existing member (the primary).
-- Admin approves/denies. On approve: requester becomes secondary, inherits ABO, promoted to member.
CREATE TABLE IF NOT EXISTS spouse_link_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_primary_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'denied')),
  admin_note       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  -- Enforce one active request per requester at a time
  CONSTRAINT uq_spouse_link_requester UNIQUE (requester_id)
);

-- Index for admin queue lookup (all pending)
CREATE INDEX IF NOT EXISTS idx_spouse_link_requests_status ON spouse_link_requests(status);
-- Index for requester self-lookup
CREATE INDEX IF NOT EXISTS idx_spouse_link_requests_requester ON spouse_link_requests(requester_id);

-- RLS
ALTER TABLE spouse_link_requests ENABLE ROW LEVEL SECURITY;

-- Requester can read their own row
CREATE POLICY "spouse_link_requests_select_own"
  ON spouse_link_requests FOR SELECT
  USING (requester_id = get_my_profile_id());

-- Requester can insert (route handler enforces guards)
CREATE POLICY "spouse_link_requests_insert_own"
  ON spouse_link_requests FOR INSERT
  WITH CHECK (requester_id = get_my_profile_id());

-- Requester can delete their own pending request
CREATE POLICY "spouse_link_requests_delete_own_pending"
  ON spouse_link_requests FOR DELETE
  USING (requester_id = get_my_profile_id() AND status = 'pending');

-- Admin: full access
CREATE POLICY "spouse_link_requests_admin_all"
  ON spouse_link_requests FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

COMMENT ON TABLE spouse_link_requests IS
  'ADR-016: Tracks guest requests to be linked as a secondary/spouse of an existing member ABO.';
