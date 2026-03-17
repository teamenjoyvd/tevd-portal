-- ISS-0054: member vital signs for event ticket tracking
CREATE TABLE member_vital_signs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  event_key   text not null,
  event_label text not null,
  has_ticket  boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  UNIQUE (profile_id, event_key)
);

CREATE OR REPLACE FUNCTION update_vital_signs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER vital_signs_updated_at
  BEFORE UPDATE ON member_vital_signs
  FOR EACH ROW EXECUTE FUNCTION update_vital_signs_updated_at();

ALTER TABLE member_vital_signs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vital_signs_select_own" ON member_vital_signs
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1));

CREATE POLICY "vital_signs_select_admin" ON member_vital_signs
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'core'));

CREATE POLICY "vital_signs_mutate_admin" ON member_vital_signs
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'core'))
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'core'));
