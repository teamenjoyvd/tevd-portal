-- Local development seed data
-- These are sample profiles and trips for local testing

-- Insert admin profile
INSERT INTO public.profiles (
  clerk_id,
  first_name,
  last_name,
  role,
  abo_number,
  contact_email
) VALUES (
  'user_admin_dev_local',
  'Admin',
  'User',
  'admin',
  'ABO-ADMIN-LOCAL',
  'admin@local.dev'
) ON CONFLICT (clerk_id) DO NOTHING;

-- Insert core team member
INSERT INTO public.profiles (
  clerk_id,
  first_name,
  last_name,
  role,
  abo_number,
  contact_email
) VALUES (
  'user_core_dev_local',
  'Core',
  'Team',
  'core',
  'ABO-CORE-LOCAL',
  'core@local.dev'
) ON CONFLICT (clerk_id) DO NOTHING;

-- Insert regular member
INSERT INTO public.profiles (
  clerk_id,
  first_name,
  last_name,
  role,
  abo_number,
  contact_email
) VALUES (
  'user_member_dev_local',
  'Jane',
  'Member',
  'member',
  'ABO-MEMBER-LOCAL',
  'member@local.dev'
) ON CONFLICT (clerk_id) DO NOTHING;

-- Insert guest user
INSERT INTO public.profiles (
  clerk_id,
  first_name,
  last_name,
  role,
  contact_email
) VALUES (
  'user_guest_dev_local',
  'Guest',
  'User',
  'guest',
  'guest@local.dev'
) ON CONFLICT (clerk_id) DO NOTHING;

-- Insert a sample trip
INSERT INTO public.trips (
  title,
  destination,
  description,
  start_date,
  end_date,
  currency,
  total_cost,
  location
) VALUES (
  'Sample Team Trip',
  'Mountain Resort',
  -- description is jsonb (Tiptap doc) since 20260516000300
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A great opportunity to connect and grow together in a beautiful setting."}]}]}',
  '2026-08-15',
  '2026-08-22',
  'EUR',
  5000,
  'Alpine Region'
) ON CONFLICT DO NOTHING;

-- The baseline snapshot is a schema-only dump without role grants;
-- restore the standard Supabase grants so PostgREST can reach the tables.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Storage buckets the app expects (private, matching prod posture per #480).
-- Created here because several prod buckets predate the migration chain.
INSERT INTO storage.buckets (id, name, public) VALUES
  ('trip-hero-images',  'trip-hero-images',  false),
  ('guide-covers',      'guide-covers',      false),
  ('guide-images',      'guide-images',      false),
  ('guide-attachments', 'guide-attachments', false),
  ('trip-proofs',       'trip-proofs',       false),
  ('trip-attachments',  'trip-attachments',  false),
  ('social-thumbnails', 'social-thumbnails', false)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS helper functions already exist in baseline schema
-- (get_my_clerk_id, get_my_profile_id, get_my_role, is_admin)
