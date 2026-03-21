-- ISS-0174: payable_items + payments + trip_registrations cancel + profiles.ui_prefs

-- ── 1. payable_items ─────────────────────────────────────────────────────────
CREATE TABLE payable_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text        NOT NULL,
  description  text,
  amount       numeric(10,2) NOT NULL,
  currency     text        NOT NULL DEFAULT 'EUR',
  item_type    text        NOT NULL CHECK (item_type IN ('trip','book','ticket','other')),
  linked_trip_id uuid      REFERENCES trips(id) ON DELETE SET NULL,
  is_active    boolean     NOT NULL DEFAULT true,
  created_by   uuid        NOT NULL REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payable_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payable_items_admin_core_all" ON payable_items
  FOR ALL
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'core'));

CREATE POLICY "payable_items_member_read" ON payable_items
  FOR SELECT
  USING (is_active = true);

-- ── 2. payments ───────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid        NOT NULL REFERENCES profiles(id),
  payable_item_id    uuid        NOT NULL REFERENCES payable_items(id),
  amount             numeric(10,2) NOT NULL,
  transaction_date   date        NOT NULL,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','approved','denied')),
  payment_method     text,
  proof_url          text,
  note               text,
  admin_note         text,
  submitted_by_member boolean   NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_member_own" ON payments
  FOR ALL
  USING (profile_id = (
    SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1
  ));

CREATE POLICY "payments_admin_core_all" ON payments
  FOR ALL
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'core'));

-- ── 3. trip_registrations: cancel columns ────────────────────────────────────
ALTER TABLE trip_registrations
  ADD COLUMN cancelled_at   timestamptz,
  ADD COLUMN cancelled_by   uuid REFERENCES profiles(id);

-- ── 4. profiles: ui_prefs column ─────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
