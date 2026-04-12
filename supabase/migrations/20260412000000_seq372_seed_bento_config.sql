-- SEQ372: Seed bento_config with the 5 known homepage tile keys.
-- Table was created empty; BentoTab renders nothing without rows.
-- ON CONFLICT DO NOTHING makes this safe to re-run.

INSERT INTO public.bento_config (tile_key, max_items)
VALUES
  ('events',        3),
  ('trips',         3),
  ('announcements', 3),
  ('howtos',        3),
  ('links',         4)
ON CONFLICT (tile_key) DO NOTHING;
