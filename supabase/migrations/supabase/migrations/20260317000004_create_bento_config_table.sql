-- ISS-0041: bento_config table for per-tile max_items admin config
CREATE TABLE bento_config (
  tile_key   text primary key,
  max_items  integer not null default 3,
  updated_at timestamptz not null default now()
);

-- Seed defaults for all configurable tiles
INSERT INTO bento_config (tile_key, max_items) VALUES
  ('events',        3),
  ('trips',         3),
  ('announcements', 3),
  ('howtos',        4),
  ('links',         4);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_bento_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bento_config_updated_at
  BEFORE UPDATE ON bento_config
  FOR EACH ROW EXECUTE FUNCTION update_bento_config_updated_at();

-- RLS
ALTER TABLE bento_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read
CREATE POLICY "bento_config_select" ON bento_config
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can update
CREATE POLICY "bento_config_update" ON bento_config
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');
