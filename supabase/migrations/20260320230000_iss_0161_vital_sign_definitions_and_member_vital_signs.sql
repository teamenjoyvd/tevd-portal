-- ISS-0161: vital_sign_definitions + member_vital_signs
-- Drops old member_vital_signs (wrong schema, zero code references) and rebuilds correctly.

DROP TABLE IF EXISTS member_vital_signs;

-- vital_sign_definitions
CREATE TABLE vital_sign_definitions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category   text        NOT NULL,
  label      text        NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vital_sign_definitions_category_check
    CHECK (category IN ('N21 CONNECT', 'N21 CONNECT+', 'BBS', 'WES', 'CEP', 'CEP+')),
  CONSTRAINT vital_sign_definitions_category_unique UNIQUE (category)
);

ALTER TABLE vital_sign_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vsd_select_authenticated"
  ON vital_sign_definitions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vsd_insert_admin"
  ON vital_sign_definitions FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin'));

CREATE POLICY "vsd_update_admin"
  ON vital_sign_definitions FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin'))
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin'));

CREATE POLICY "vsd_delete_admin"
  ON vital_sign_definitions FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin'));

INSERT INTO vital_sign_definitions (category, is_active, sort_order) VALUES
  ('N21 CONNECT',  true, 0),
  ('N21 CONNECT+', true, 1),
  ('BBS',          true, 2),
  ('WES',          true, 3),
  ('CEP',          true, 4),
  ('CEP+',         true, 5);

-- member_vital_signs (new schema)
CREATE TABLE member_vital_signs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  definition_id uuid        NOT NULL REFERENCES vital_sign_definitions(id) ON DELETE CASCADE,
  recorded_at   date        NOT NULL DEFAULT current_date,
  recorded_by   uuid        NOT NULL REFERENCES profiles(id),
  note          text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_vital_signs_unique UNIQUE (profile_id, definition_id)
);

ALTER TABLE member_vital_signs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mvs_select"
  ON member_vital_signs FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1)
    OR (auth.jwt() ->> 'user_role') IN ('admin')
  );

CREATE POLICY "mvs_insert_admin"
  ON member_vital_signs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin'));

CREATE POLICY "mvs_delete_admin"
  ON member_vital_signs FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin'));
