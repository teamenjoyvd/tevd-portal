-- ISS-0039: Howtos table
CREATE TABLE howtos (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  title            jsonb not null default '{"en":"","bg":""}',
  cover_image_url  text,
  emoji            text,
  body             jsonb not null default '[]',
  access_roles     text[] not null default '{guest,member,core,admin}',
  is_published     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_howtos_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER howtos_updated_at
  BEFORE UPDATE ON howtos
  FOR EACH ROW EXECUTE FUNCTION update_howtos_updated_at();

-- RLS
ALTER TABLE howtos ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read published howtos where their role is in access_roles
CREATE POLICY "howtos_select_published" ON howtos
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND (
      (auth.jwt() -> 'user_role')::text = ANY(
        SELECT jsonb_array_elements_text(to_jsonb(access_roles))
      )
    )
  );

-- Admin and core can read all (including drafts)
CREATE POLICY "howtos_select_admin_core" ON howtos
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('admin', 'core')
  );

-- Only admin can insert/update/delete
CREATE POLICY "howtos_insert_admin" ON howtos
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY "howtos_update_admin" ON howtos
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY "howtos_delete_admin" ON howtos
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');
