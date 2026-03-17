-- ISS-0047: add ical_token column to profiles for per-user signed calendar URL
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ical_token text;
