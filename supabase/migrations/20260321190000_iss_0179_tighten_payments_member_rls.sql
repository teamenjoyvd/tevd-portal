-- ISS-0179: Tighten RLS on payments — replace FOR ALL member policy with INSERT + SELECT only
-- Risk: payments_member_own (FOR ALL) allowed members to UPDATE their own rows,
-- including flipping status off 'pending' — a privilege escalation vector.

DROP POLICY IF EXISTS "payments_member_own" ON payments;

-- Members can INSERT their own rows only, and only with status='pending'
CREATE POLICY "payments_member_insert" ON payments
  FOR INSERT
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
    AND status = 'pending'
  );

-- Members can SELECT their own rows
CREATE POLICY "payments_member_select" ON payments
  FOR SELECT
  USING (
    profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
  );

-- No member UPDATE or DELETE policy. Only admin/core via payments_admin_core_all.
